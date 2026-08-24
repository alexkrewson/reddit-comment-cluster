# Distillery on Google Play — the road to closed testing

Written 2026-08-23, at the point where the Android app first built. Everything
here that is marked **learned** was paid for once already by `argument_mapper`
(iDisagree), which is on the closed track now; the citations are to its
`maintenance_todo.txt`, which is the better record of the two.

Google requires **12 testers opted in continuously for 14 days** before a
personal-account app can be promoted to production. The clock only runs while
twelve are opted in, so a tester who drops out on day nine resets more than
their own participation.

---

## Where this stands

**Done, in the repo:**

- Capacitor Android project, `com.alexkrewson.distillery`, app name Distillery.
- `npm run build:apk` produces a working debug APK and uploads it to
  `gdrive:AndroidBuilds/<repo folder>/` with a version + timestamp + sha filename.
  Verified once: `app-debug-v51-20260823-1700-4716f04-dirty.apk`.
- `versionCode` derived from the commit count (51 at time of writing), so no two
  builds are indistinguishable on the phone.
- The four WebView breakages fixed — clipboard, redirect origin, sign-in, back
  button. See the commit message on `f114e36` for what each one was.
- Buy Credits removed on Android, before any Android user can ever have paid.
- `allowBackup=false`, so the Supabase session token does not travel to Drive.
- Privacy policy at `privacy/index.html`, with a `#delete` anchor.
- Two verification scripts, and both pass:
  - `npm run verify:apk` reads the shipped artifact back and checks nine things
    plus the signature. It parses the zip in-process — `unzip` is not installed
    here and the `tar` on PATH is GNU tar, which can read neither a Windows path
    nor a zip. It uses **apksigner, not jarsigner**: modern APKs sign with
    scheme v2/v3, which has no `META-INF/MANIFEST.MF`, so jarsigner calls a
    perfectly good APK `no manifest.` and teaches you to ignore the line.
  - `npm run probe:device` asks the *running* app what is true of it, over the
    WebView's devtools socket. Different question from the first: a native gate
    can be correctly packaged and still evaluate the wrong way.
  - `npm run validate:apk` chains build → verify → install → probe.

**Proven on an emulator (Android 16, API 36), 2026-08-23** — not inferred from a
green build:

| Claim | Observed |
|---|---|
| App launches and is the resumed activity | `topResumedActivity=…distillery/.MainActivity` |
| The WebView origin really is `https://localhost` | logcat: `Handling local request: https://localhost/`, and `window.location.origin` |
| `publicAppUrl()` substitutes the real site | returns `https://distillery.trolleysolution.com/` |
| No Stripe purchase path on Android | `#buy-credits-btn` is absent from the live DOM |
| Code sign-in is reachable | `#auth-code-row` exists |
| Clipboard and App plugins registered | both true |
| No JavaScript errors on load | none |

**Not done, and roughly in the order it matters:**

1. The account-deletion feature (see the next section — this is the real risk).
2. Hosting: Cloudflare Pages project + `distillery.trolleysolution.com`.
3. Supabase: `{{ .Token }}` in the email template, and the redirect allow-list.
4. The upload keystore.
5. Store assets: icon, feature graphic, screenshots, listing copy.
6. Play Console setup, then the AAB, then testers.

---

## The one thing most likely to get this rejected

**Distillery has no in-app account deletion, and Play requires one for any app
that lets users create an account.** The privacy page currently offers an email
route only, which is honest about what exists today but is the weaker version of
what iDisagree submitted — iDisagree had an in-app *Settings → Account → Delete
my data* button *and* the email route for people who had already uninstalled,
and that combination passed review.

It is worth building before submitting rather than after a rejection. What it
needs:

- A `delete` RLS policy on `comment_cluster.analyses`. There is currently only
  `select` and `insert` (see `HANDOFF.md`), which means a client-side delete
  would silently affect zero rows and *look* like it worked — the same class of
  silent failure as the Gradle upload hook.
- A button in Settings → Account that deletes the user's rows and zeroes the
  credit balance, with a confirmation.
- Account deletion proper (removing the row from `auth.users`) needs the service
  role, so it has to be a Worker route rather than a client call.

One thing to get right, because this Supabase project is shared: **deleting an
account here deletes the sign-in that `packing_list` also uses.** iDisagree got
to say "deleting your account affects only this app" because it moved to its own
project on 2026-08-02. Distillery is still on the keeper (`ycuuxnscbxiibsnefgef`)
alongside packing_list, so the same sentence would be false here. Either say so
plainly in the confirmation dialog, or split the project first.

---

## 1. Hosting — `distillery.trolleysolution.com`

Cloudflare Pages, matching iDisagree. `npm run deploy` is already wired for a
project named `distillery`, deploying `www/` from `main`.

- `npm run build:web` stages `bookmarklet.html` as **both** `index.html` and
  `bookmarklet.html`. That is deliberate: the app has been served from
  `.../bookmarklet.html` since it was a bookmarklet, real people have it
  bookmarked, and it is a copy rather than a redirect so nothing — including a
  review process — is ever handed a 3xx.
- Privacy URL for Play: `https://distillery.trolleysolution.com/privacy/`
  **with the trailing slash.** Data deletion URL:
  `https://distillery.trolleysolution.com/privacy/#delete`.
  **Learned:** iDisagree found `/privacy.html` 308-redirects; browsers follow it,
  but do not hand a redirect to a review process. Confirm both return HTTP 200
  before pasting them into the console.

**A pushed commit that fails to build is silent from outside** — the site just
keeps serving the old bundle. iDisagree lost ~40 minutes to exactly this and
added a `deploy:verify` that checks the live bundle hash, because "deploy
succeeded" and "users see the new code" are different claims. Worth copying here
once there is something to verify.

## 2. Supabase

- **Add `{{ .Token }}` to the Magic Link email template** (Auth → Email
  Templates). Without it no one can sign in to the Android app at all: a magic
  link has to redirect somewhere, and the WebView's origin is `https://localhost`.
  Keep `{{ .ConfirmationURL }}` alongside it so the email carries both — that
  way nothing changes for web users or for packing_list, which shares this
  project's auth.
- **Add `https://distillery.trolleysolution.com/**` to the redirect allow-list**
  (Authentication → URL Configuration), alongside the existing entries.
- Custom SMTP is already configured on this project via Resend. **Warm the
  sending domain** before twelve signups arrive at once, or they land in spam.

## 3. The upload keystore

**Learned, and it is the expensive one:** `build.gradle` skips signing when
`keystore.properties` is absent and *still* reports `BUILD SUCCESSFUL`,
producing a bundle Play rejects. Check for the signature, do not infer it from a
green build.

Generate once:

```
keytool -genkeypair -v -keystore android/upload-keystore.jks \
  -alias upload -keyalg RSA -keysize 4096 -validity 10000
```

Then `android/keystore.properties` (gitignored, as is `*.jks`):

```
STORE_FILE=upload-keystore.jks
STORE_PASSWORD=...
KEY_ALIAS=upload
KEY_PASSWORD=...
```

**Back both up off this machine before the first upload.** After the first
upload the choice of key is locked; losing it means never publishing an update
under that key again. iDisagree ended up with two competing keystores on two
machines and had to settle which was canonical before it could submit.

## 4. Store assets — and the fix that must come first

**Do the system bars before capturing anything.** The launch screenshot shows
white bands above and below the app: the status and navigation bars are the
system default against Distillery's near-black Ember canvas. It is visible in
the very first screenshot anyone would take.

**Learned:** iDisagree deferred exactly this and it cost it the screenshots. It
is not the one-line colour change it looks like — `targetSdk 36` deprecates
`statusBarColor`, so it needs edge-to-edge plus safe-area insets plus per-theme
icon polarity, and Distillery has **eight** themes across light and dark. Its
own note is blunt about the ordering: *"Fix the system bars first. It changes how
every screen looks, so any screenshot taken before it is wasted work."*

Distillery currently also ships **Capacitor's default launcher icon**. That has
to change before anyone sees it.

- Launcher icon, and a **512×512** PNG for the listing.
- Feature graphic, **1024×500**.
- Phone screenshots, 2–8, at **1080×2400**. Tablets are optional; if you do add
  them, 7-inch is 1080×1920 and 10-inch 1440×2560, both strictly 16:9 or 9:16.
- Short description ≤ 80 characters, full description ≤ 4000.

**Learned, twice over:** write the capture as a script and keep it. iDisagree's
first phone set was ad hoc, the script was thrown away, and when a system-bar fix
changed how every screen looked, the shots could not be regenerated — its tablet
and phone sets ended up on different themes and different content, which on one
listing reads as two different apps. Pick one theme and one worked example, and
capture all sizes from it.

Store listing changes are independent of releases: they can be updated any time,
get a quick review, and need no new build.

## 5. Play Console

Identity verification is already cleared on this account from iDisagree — that
was a multi-day block the first time (Create app is greyed out until it passes),
and it does not repeat.

In order:

1. Create the app. Package `com.alexkrewson.distillery`.
2. **Pricing: paid.** Free→paid is blocked once published; paid→free is allowed
   once. Choosing paid keeps every door open, which is why iDisagree did.
3. App content: privacy policy URL, data deletion URL, content rating, target
   audience, and the **Advertising ID declaration** (Distillery does not use one).
4. **Data Safety.** Declare email address, and the user content stored in
   history. No analytics, no ad ID, no crash reporting — unless Sentry gets added
   first, in which case crash logs/diagnostics must be declared too.
5. Set a price **for every country**, not just the default.
6. Create the closed testing track, upload the AAB, add the tester group.

**Learned:** items 3, 5 and the Advertising ID declaration were not on
iDisagree's own 13-item setup checklist and only surfaced when the send was
attempted. Expect a third ambush.

## 6. Building the thing you actually upload

```
npm run build:aab:release
```

Then **read the artifact back rather than assuming** — this is the check that
would have caught iDisagree's stale bundle, which pointed at the wrong Supabase
project and was nearly uploaded:

- `ycuuxnscbxiibsnefgef` present, `xjcdicxchvmujjfnpbia` absent
- `distillery.trolleysolution.com` present (the native `WEB_ORIGIN`)
- `verifyOtp` present (code sign-in — without it nobody can log in)
- `buy-credits-btn').remove()` present (no Stripe path on Android)
- signed with the upload key

That is `npm run verify:aab`, which runs exactly those checks and exits non-zero
if any fails. It reads an AAB from `base/assets/` rather than `assets/`, and
checks the signature with jarsigner for a bundle (an AAB is a jar) and apksigner
for an APK.

The one check it cannot make is that you built from a clean tree. The uploader
stamps `-dirty` into the filename when you did not, which is the cheapest
possible reminder — iDisagree cut its submission artifacts from a clean tree
deliberately and recorded the sha.

## 7. Testers

**Learned, and this was iDisagree's longest-running blocker — recruitment, not
engineering.** Twelve must be opted in *continuously* for fourteen days, so aim
for fifteen, tell them not to uninstall, and check they are on Android. An
iPhone friend can usefully test the web app but cannot count toward the twelve.

- **Testers can be bought.** TesterBee, $14.99 for 12 testers × 14 days with auto
  approval, was live for iDisagree on 2026-08-21. Google expects genuine testers,
  so a bought round is a grey area — known and accepted there, not overlooked.
  Their support email `hello@testerbee.com` **bounces**; use testerbee.com/contact
  or WhatsApp. A "Failed to load app" dashboard error is a transient Firestore
  index build and clears in minutes.
- Use a **separate Google Group per source**. Groups cannot see each other's
  members, which is the reason to have two rather than one list.
- **For free installs of a paid app, use an app-level discount, not promo codes.**
  This superseded the promo-code route on 2026-08-21. A discount is set against
  the app's own price, applies to everyone Play offers the app to, and reverts by
  itself when the window closes — it is *not* the one-way door that paid→free is.
  Friends have installed free under one.
  - The edge a promo code has: it expires on redemption rather than on a date. A
    replacement tester recruited on day ten is not covered if the discount window
    started before the round did. **Check the end date outlasts the round**, not
    merely that it spans fourteen days.
  - Licence testing does **not** grant a free install of a paid app. That was
    tested and the answer was no: it covers in-app purchases only.

---

## Housekeeping this rename leaves behind

- The Drive upload folder is derived from the repo's directory name, so renaming
  the directory to `distillery` starts a fresh `AndroidBuilds/distillery/`. That
  is arguably cleaner than sixteen lookalike builds in the old folder; if you
  want continuity instead, pass `--dest=AndroidBuilds/reddit-comment-cluster/`.
- `maintenance_todo.md` is deliberately **not** renamed. Its blocks are accurate
  history for their own dates, and rewriting "Analyzer" through them would
  falsify the record — the same convention iDisagree's log follows.
- `APP_ID` in `reddit-proxy-worker.js` is still `'analyzer'` on purpose. It is a
  wire value stamped into live Stripe metadata, not a display name.
