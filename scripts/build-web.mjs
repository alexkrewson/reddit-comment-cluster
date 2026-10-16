// Build the static web bundle into www/.
//
// There is no bundler here on purpose. The whole frontend is one hand-written
// file, bookmarklet.html, and a bundler would buy nothing but a rewrite. It
// stages www/ for a Cloudflare Pages deploy (npm run deploy), keeping two URLs:
//
//   /index.html       the site root
//   /bookmarklet.html the URL the app has been served from since it was a
//                     bookmarklet. Real people have it bookmarked; it is a
//                     copy, not a redirect.
//
// Also copies privacy/ verbatim, so /privacy/ answers 200 rather than a
// redirect.

import { cp, mkdir, rm, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "www");

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const html = await readFile(path.join(root, "bookmarklet.html"), "utf8");
await writeFile(path.join(out, "index.html"), html);
await writeFile(path.join(out, "bookmarklet.html"), html);
console.log("build-web: index.html + bookmarklet.html");

for (const dir of ["privacy", "assets"]) {
  const src = path.join(root, dir);
  if (existsSync(src)) {
    await cp(src, path.join(out, dir), { recursive: true });
    console.log(`build-web: ${dir}/`);
  } else {
    console.log(`build-web: no ${dir}/ to copy`);
  }
}

const listed = await readdir(out);
console.log(`build-web: www/ contains ${listed.join(", ")}`);
