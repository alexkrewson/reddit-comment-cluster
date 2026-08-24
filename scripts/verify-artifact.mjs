// Read an APK or AAB back and prove what is actually inside it.
//
// "It built" and "it contains what I think it contains" are different claims.
// argument_mapper nearly uploaded a bundle pointing at the wrong Supabase
// project, and the only thing that would have caught it was opening the
// artifact and looking. So: open the artifact and look.
//
//   node scripts/verify-artifact.mjs android/app/build/outputs/apk/debug/app-debug.apk
//   node scripts/verify-artifact.mjs android/app/build/outputs/bundle/release/app-release.aab
//
// Exits non-zero if any check fails, so it can gate a release.
//
// The zip is parsed here rather than shelled out to, because neither obvious
// external tool is dependable on this machine: `unzip` is not installed, and the
// `tar` Git Bash puts on PATH is GNU tar, which reads "C:\..." as a remote
// host:path AND cannot read zip archives at all. Windows' own bsdtar can, but
// which one wins on PATH is a coin flip. Forty lines of zip reader removes the
// question entirely.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import path from "node:path";

/** Pull one named file out of a zip archive. Returns a Buffer, or null. */
function readZipEntry(buf, wanted) {
  // End of Central Directory record: signature, then the count and offset of
  // the central directory. Scan backwards because it sits behind a comment of
  // unknown length.
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip archive (no end-of-central-directory record)");

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("corrupt central directory");
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);

    if (name === wanted) {
      // The local header repeats the name and extra fields, and its extra
      // length often differs from the central one — so read it from the local
      // header rather than reusing the value above.
      const lNameLen = buf.readUInt16LE(localOff + 26);
      const lExtraLen = buf.readUInt16LE(localOff + 28);
      const start = localOff + 30 + lNameLen + lExtraLen;
      const raw = buf.subarray(start, start + compSize);
      if (method === 0) return raw;            // stored
      if (method === 8) return inflateRawSync(raw); // deflated
      throw new Error(`unsupported zip compression method ${method} for ${name}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

const artifact = process.argv[2];
if (!artifact || !existsSync(artifact)) {
  console.error("usage: node scripts/verify-artifact.mjs <path to .apk or .aab>");
  process.exit(2);
}

// An AAB lays the web assets out under base/assets/, an APK under assets/.
const assetRoot = artifact.endsWith(".aab") ? "base/assets" : "assets";
const entry = `${assetRoot}/public/index.html`;

const zip = readFileSync(path.resolve(artifact));
const found = readZipEntry(zip, entry);
if (!found) {
  console.error(`FAIL  ${entry} is not inside ${artifact}`);
  console.error("      the web assets never made it in — did build:web run?");
  process.exit(1);
}
const html = found.toString("utf8");

// Each check is [label, needle, expected count]. Counts, not booleans: "the
// right project appears" is a weaker claim than "the wrong one appears zero
// times", and only the second one would have caught iDisagree's stale bundle.
const checks = [
  ["keeper Supabase project", "ycuuxnscbxiibsnefgef", 1],
  ["retired project absent", "xjcdicxchvmujjfnpbia", 0],
  // Twice on one line, not a typo: a typeof guard and then the call.
  ["native bridge", "CAP.isNativePlatform", 2],
  ["real web origin for native", "distillery.trolleysolution.com", 1],
  ["redirect URLs go through publicAppUrl", "publicAppUrl()", 3],
  ["6-digit code sign-in", "verifyOtp", 1],
  ["hardware back button", "addListener('backButton'", 1],
  ["no Stripe path on Android", "buy-credits-btn').remove()", 1],
  ["app is named Distillery", "<title>Distillery</title>", 1],
];

let failed = 0;
for (const [label, needle, want] of checks) {
  const got = html.split(needle).length - 1;
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label.padEnd(38)} found ${got}, want ${want}`);
}

// Signing gets its own line because "unsigned" is the failure that still prints
// BUILD SUCCESSFUL — build.gradle skips signing when keystore.properties is
// missing and says nothing about it.
//
// apksigner, NOT jarsigner. Modern APKs are signed with APK Signature Scheme
// v2/v3, which does not use META-INF/MANIFEST.MF at all, so jarsigner reports a
// perfectly well-signed APK as "no manifest." — a false failure that would teach
// you to ignore this line. An AAB is a jar, so jarsigner is right for that one.
const firstLine = (s) => s.trim().split(/\r?\n/)[0];

function verifySignature(file) {
  if (file.endsWith(".aab")) {
    const out = execFileSync("jarsigner", ["-verify", file], { stdio: "pipe", encoding: "utf8" });
    return { ok: /jar verified/i.test(out), detail: firstLine(out) };
  }
  const tools = path.join(process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "", "build-tools");
  const versions = existsSync(tools) ? readdirSync(tools).sort().reverse() : [];
  for (const v of versions) {
    const bin = path.join(tools, v, process.platform === "win32" ? "apksigner.bat" : "apksigner");
    if (!existsSync(bin)) continue;
    const out = execFileSync(bin, ["verify", "--print-certs", file], {
      stdio: "pipe", encoding: "utf8", shell: process.platform === "win32",
    });
    const signer = (out.match(/Signer #1 certificate DN: (.*)/) || [])[1] || "signed";
    return { ok: true, detail: `${signer} (via build-tools ${v})` };
  }
  throw new Error("apksigner not found under $ANDROID_HOME/build-tools");
}

try {
  const { ok, detail } = verifySignature(path.resolve(artifact));
  console.log(`${ok ? "ok  " : "FAIL"}  ${"signed".padEnd(38)} ${detail}`);
  if (!ok && /release/.test(artifact)) failed++;
} catch (e) {
  const msg = firstLine(String(e.stderr || e.message));
  const isRelease = /release/.test(artifact);
  console.log(`${isRelease ? "FAIL" : "WARN"}  ${"signed".padEnd(38)} ${msg}`);
  if (isRelease) failed++;
}

console.log("");
if (failed) {
  console.error(`${failed} check(s) failed — do not upload this artifact.`);
  process.exit(1);
}
console.log(`${artifact} verified.`);
