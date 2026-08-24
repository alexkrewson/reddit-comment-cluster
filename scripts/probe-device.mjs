// Ask the RUNNING app on a device/emulator what is actually true of it.
//
// verify-artifact.mjs reads the shipped file; this reads the live page. They
// answer different questions: the first proves the right code was packaged, the
// second proves it behaves as intended once Capacitor has booted it. A native
// gate can be present in the bundle and still evaluate the wrong way.
//
//   npm run build:apk
//   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
//   adb shell am start -n com.alexkrewson.distillery/.MainActivity
//   node scripts/probe-device.mjs
//
// Needs a DEBUG build: release WebViews have no devtools socket.

import { execFileSync } from "node:child_process";
import path from "node:path";

const APP_ID = "com.alexkrewson.distillery";
const PORT = 9222;

const adb = path.join(
  process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "",
  "platform-tools",
  process.platform === "win32" ? "adb.exe" : "adb",
);
const sh = (args) => execFileSync(adb, args, { encoding: "utf8" }).trim();

const pid = sh(["shell", "pidof", APP_ID]).split(/\s+/)[0];
if (!pid) {
  console.error(`${APP_ID} is not running. Launch it first:`);
  console.error(`  adb shell am start -n ${APP_ID}/.MainActivity`);
  process.exit(2);
}
sh(["forward", `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`]);

const list = await (await fetch(`http://localhost:${PORT}/json`)).json();
const page = list.find((p) => p.type === "page" && p.webSocketDebuggerUrl);
if (!page) {
  console.error("no debuggable WebView page found — is this a debug build?");
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params) =>
  new Promise((res) => { pending.set(++id, res); ws.send(JSON.stringify({ id, method, params })); });
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
await new Promise((res) => ws.addEventListener("open", res));

// [label, expression, expected]. `undefined` expected means "report, don't judge".
const probes = [
  // The whole reason the native branches exist. If this ever stops being
  // https://localhost, revisit publicAppUrl() rather than celebrating.
  ["WebView origin", "window.location.origin", "https://localhost"],
  ["IS_NATIVE", "IS_NATIVE", true],
  ["publicAppUrl()", "publicAppUrl()", "https://distillery.trolleysolution.com/"],
  // Play Payments policy: there must be no Stripe purchase path on Android.
  ["Buy Credits absent", "!document.getElementById('buy-credits-btn')", true],
  // The only sign-in route Android has.
  ["code entry present", "!!document.getElementById('auth-code-row')", true],
  ["Clipboard plugin", "!!(Capacitor.Plugins && Capacitor.Plugins.Clipboard)", true],
  ["App plugin (back button)", "!!(Capacitor.Plugins && Capacitor.Plugins.App)", true],
  ["page title", "document.title", "Distillery"],
];

let failed = 0;
for (const [label, expr, want] of probes) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  const thrown = r.result?.exceptionDetails?.exception?.description;
  const got = r.result?.result?.value;
  if (thrown) {
    failed++;
    console.log(`FAIL  ${label.padEnd(26)} threw: ${thrown.split("\n")[0]}`);
    continue;
  }
  const ok = want === undefined || JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label.padEnd(26)} ${JSON.stringify(got)}`);
}

ws.close();
console.log("");
console.log(failed ? `${failed} probe(s) failed.` : "device probes passed.");
process.exit(failed ? 1 : 0);
