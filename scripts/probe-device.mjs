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

// Wait for the process rather than asking once. `am start` returns as soon as
// the intent is dispatched, not when the app is up, so a probe chained straight
// after it asks before there is anything to ask about -- and `pidof` EXITS 1
// when it finds nothing, which throws out of execFileSync rather than returning
// the empty string the check below expects. Wait on the condition you are about
// to assert.
async function waitForPid(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const pid = sh(["shell", "pidof", APP_ID]).split(/\s+/)[0];
      if (pid) return pid;
    } catch { /* pidof exits 1 when the process is not up yet */ }
    if (Date.now() > deadline) return null;
    await new Promise((r) => setTimeout(r, 400));
  }
}

const pid = await waitForPid();
if (!pid) {
  console.error(`${APP_ID} never came up. Launch it and try again:`);
  console.error(`  adb shell am start -n ${APP_ID}/.MainActivity`);
  process.exit(2);
}
sh(["forward", `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`]);

// The WebView registers its devtools socket a moment after the process exists,
// so this waits too rather than assuming the pid was the last thing to happen.
async function waitForPage(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const list = await (await fetch(`http://localhost:${PORT}/json`)).json();
      const page = list.find((p) => p.type === "page" && p.webSocketDebuggerUrl);
      if (page) return page;
    } catch { /* socket not listening yet */ }
    if (Date.now() > deadline) return null;
    await new Promise((r) => setTimeout(r, 400));
  }
}

const page = await waitForPage();
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

// Wait until the page has finished running its script before asking it anything.
//
// Attaching is not readiness. A probe that fires mid-execution sees a page where
// `publicAppUrl` already resolves but `IS_NATIVE` does not -- function
// declarations are hoisted and callable the moment the script starts, while a
// top-level `const` is in its temporal dead zone until execution reaches the
// line. That asymmetry is what a flaky "IS_NATIVE is not defined" actually means,
// and it is a property of the harness, not a bug in the app.
async function waitForReady(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  const expr = "document.readyState === 'complete' && typeof IS_NATIVE !== 'undefined'";
  for (;;) {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
    if (r.result?.result?.value === true) return true;
    if (Date.now() > deadline) return false;
    await new Promise((res) => setTimeout(res, 250));
  }
}
if (!(await waitForReady())) {
  console.error("the page never finished initialising — probing it would report noise");
  ws.close();
  process.exit(1);
}

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
