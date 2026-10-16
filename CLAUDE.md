# Distillery — notes for future sessions

*(was "Analyzer", and before that "Reddit Comment Cluster". Renamed 2026-08-23.)*

Read the shared conventions first: `CHANGELOG.md`, then `best-practices.md`,
`css-best-practices.md` and `testing-guidelines.md`. They live in the
`apps-shared` repo — `../apps-shared/` here, otherwise
`github.com/alexkrewson/apps-shared`. Say "sync shared" to have them re-applied
to this project.

See `HANDOFF.md` for what the app is. **`PLAY-STORE.md` is the current work** —
getting this onto the Play closed track, and what iDisagree already learned the
expensive way about doing that.

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
  `www/`. `npm run build:web` stages the same file as both `index.html` (what the
  Android WebView loads) and `bookmarklet.html` (the URL people have bookmarked).
- **This app shares `auth.users` with packing_list** on the keeper Supabase
  project `ycuuxnscbxiibsnefgef`. Deleting an account here deletes their sign-in
  there too. iDisagree moved to its own project on 2026-08-02 and no longer has
  this constraint; Distillery still does.

## Android

`npm run build:apk` for a debug build, `npm run build:aab:release` for what Play
wants. Both stage the web assets first and upload the artifact to Google Drive
via the **shared** `apps-shared/scripts/upload-apk.mjs` — never a copy in this
repo; `art_app` is what a local copy costs.

`versionCode` is derived from the commit count. Never type one: a fixed value
makes every build indistinguishable on the phone, and then "I installed the fix
and it still does it" cannot be told apart from a failed fix.

Four things work on the web and are broken in an Android WebView, all fixed here
and all worth not rediscovering: `navigator.clipboard` is refused;
`window.location.origin` is `https://localhost`; a magic link therefore cannot
sign anyone into the app (6-digit codes are the only Android sign-in path, and
they need `{{ .Token }}` in the Supabase email template); and the hardware back
button closes the app from anywhere unless handled.

Buy Credits is removed on native, deliberately, from before the first release —
Play's Payments policy wants Play Billing for anything consumed in-app.

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
Frontend and Android wrapper need Node; see `package.json`.
