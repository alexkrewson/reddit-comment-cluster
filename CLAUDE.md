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

`comment_cluster.py` still has a Reddit API `client_id` and `client_secret`
hardcoded at lines 95-96, and **this repo is public** (confirmed 2026-08-23).
They have been readable by anyone since commit `6cb7b34`. Deleting the lines does
not help on its own — they remain in git history and the GitHub API — so the fix
is to rotate at reddit.com/prefs/apps and read from the environment.

If those are the same credentials the Worker holds as `REDDIT_CLIENT_ID` /
`REDDIT_CLIENT_SECRET`, rotating breaks the live app until the Worker secrets are
updated too. Do both in one go.

## Stack

Python scripts need `praw` and `requests`. Data lives in the keeper Supabase
project under the `comment_cluster` schema (`analyses`, `profiles`).
Frontend and Android wrapper need Node; see `package.json`.
