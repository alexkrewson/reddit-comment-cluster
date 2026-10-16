# Distillery — notes for future sessions

*(was "Analyzer", and before that "Reddit Comment Cluster". Renamed 2026-08-23.)*

Read the shared conventions first: `CHANGELOG.md`, then `best-practices.md`,
`css-best-practices.md` and `testing-guidelines.md`. They live in the
`apps-shared` repo — `../apps-shared/` here, otherwise
`github.com/alexkrewson/apps-shared`. Say "sync shared" to have them re-applied
to this project.

See `HANDOFF.md` for what the app is. **The Play release was dropped on
2026-10-16** (see the top of `PLAY-STORE.md` for why): Distillery is a web app.
The Android project was then deleted; it is in git history up to `ec73db4`.

The frontend that matters is `bookmarklet.html`, still a single hand-written
file; the root `.py` scripts are older analysis tooling.

## Non-negotiables

- **`APP_ID` in `reddit-proxy-worker.js` is `'analyzer'` and must stay that way.**
  It is stamped into live Stripe session metadata and checked by
  `/stripe-webhook`; changing it orphans in-flight sessions. Same reasoning as
  iDisagree keeping its `debates` table. The Stripe account is shared between the
  two apps, and both webhooks match on this marker.
- **`maintenance_todo.md` is history, not a live document.** Each block is
  accurate for its own date. Do not rewrite "Analyzer" through it — add a new
  block at the top instead.
- **`bookmarklet.html` is the source of truth; `www/` is generated.** Never edit
  `www/`. `npm run build:web` stages the same file as both `index.html` and
  `bookmarklet.html` (the URL people have bookmarked), for the not-yet-used
  Cloudflare Pages deploy. GitHub Pages serves the repo root directly.
- **This app shares `auth.users` with packing_list** on the keeper Supabase
  project `ycuuxnscbxiibsnefgef`. Deleting an account here deletes their sign-in
  there too. iDisagree moved to its own project on 2026-08-02 and no longer has
  this constraint; Distillery still does.

## Android (removed 2026-10-16)

The Capacitor wrapper, its build/verify scripts and the native branches in
`bookmarklet.html` are gone; recover them from `ec73db4` if ever needed. What it
taught, for any future wrapper: in an Android WebView `navigator.clipboard` is
refused, `window.location.origin` is `https://localhost` (so magic links cannot
sign in; codes can), and the hardware back button closes the app unless
handled. `apps-shared/scripts/upload-apk.mjs` is the shared uploader.

## Security

The Reddit app `comment_cluster/1.0` (a personal-use script) has a leaked
secret: it was hardcoded in `comment_cluster.py` from commit `6cb7b34` until
`b94a4c4`, and **this repo is public**. The script now reads
`REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` from the environment, but the old
values are still in git history.

**It cannot be rotated, and must not be deleted** (found 2026-10-16). It is the
only app on the account, so the Worker uses it too. Since Reddit's Responsible
Builder Policy (2025-11-11), "create app" gives no new app without a manually
reviewed access request, so deleting this one would break every Reddit feature
with no replacement. What a leak allows: app-only, read-only requests against
this app's rate limit. It does not allow signing in as the account. Rotate only
after an access request is approved: create the new app, run `wrangler secret
put` for both Worker secrets, check the live site, *then* delete the old app.

## Stack

Python scripts need `praw` and `requests`. Data lives in the keeper Supabase
project under the `comment_cluster` schema (`analyses`, `profiles`).
Node is only needed for `wrangler` and `npm run build:web`; see `package.json`.
