// Check the store listing copy against Play's limits, before the console does.
//
//   node scripts/check-listing.mjs
//
// Play truncates silently in some places and rejects in others, and either way
// you find out at the form. Counting here is free. It also flags em dashes,
// which Alex does not want in store copy.

import { readFile } from "node:fs/promises";

const LIMITS = { "App name": 30, "Short description": 80, "Full description": 4000 };
const src = await readFile("store-listing.md", "utf8");

// Each section is a fenced block under its "## <name>" heading.
const blocks = [...src.matchAll(/## ([^\n(]+?)(?:\s*\(max \d+\))?\n+```\n([\s\S]*?)\n```/g)];
if (!blocks.length) {
  console.error("no fenced copy blocks found in store-listing.md");
  process.exit(2);
}

let failed = 0;
for (const [, rawName, body] of blocks) {
  const name = rawName.trim();
  const limit = LIMITS[name];
  // Count what Play counts: the copy itself, without the trailing newline the
  // fence adds.
  const len = body.trimEnd().length;
  if (limit) {
    const ok = len <= limit;
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"}  ${name.padEnd(20)} ${len} / ${limit}`);
  } else {
    console.log(`      ${name.padEnd(20)} ${len} chars (no limit checked)`);
  }
  if (body.includes("—")) {
    failed++;
    console.log(`FAIL  ${name.padEnd(20)} contains an em dash`);
  }
}

console.log("");
if (failed) { console.error(`${failed} problem(s) in store-listing.md`); process.exit(1); }
console.log("store listing copy is within limits.");
