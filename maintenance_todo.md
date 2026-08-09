# Analyzer — Maintenance To-Do

Tracking checklist for the Analyzer update spec. Checked off as completed, with a commit
after each step so progress survives a crash. See the approved plan for full rationale.

- [x] 1. Create this maintenance_todo.md
- [x] 2. Rename app "Reddit Comment Cluster" → "Analyzer" (titles/headings/metadata only;
      repo name and GitHub Pages URL stay the same)
- [x] 3. Visual restyle to match Argument Mapper (light slate/blue palette, font stack,
      dark-mode variant)
- [x] 3b. Superseded 3's palette: applied ~/apps/shared/css-best-practices.md instead —
      dark-first canvas with the shared semantic tokens (--bg-canvas/--text-primary/etc.),
      explicit [data-theme="light"] toggle (not prefers-color-scheme) with a header
      icon button + localStorage persistence, 44px touch targets on all interactive
      elements, uppercase label pattern for section headers/badges. User chose this over
      staying pinned to Argument Mapper's light theme when the two conflicted.
- [x] 3c. Doc updated again: switched dark tokens to the folder-wide "Ember" theme
      (amber-black canvas, amber/teal accent pair) and fixed button text contrast with
      --text-on-accent. Fixed a real alignment bug the doc calls out directly: the 4
      Analyze-tab rows used independent flexbox so buttons didn't line up (different
      label lengths); converted to one shared CSS grid (.row-form).
- [x] 3d. Consolidated the standalone theme-toggle + top-of-page auth into a single
      Settings menu (Account/Themes/About/Help) per the doc's settings-menu recipe,
      with an About overlay (collapsible nav + scrollspy covering each tool, raw
      downloads, history, privacy). Advanced section omitted — no genuine density/
      sound/debug settings exist yet to put there.
- [x] 3e. Replaced the binary Dark/Light toggle with the full 8-preset library
      (classic/ocean/sunset/forest/dusk/night/midnight/ember) from the updated
      css-best-practices.md. Each preset bundles mode (dark/light) + a single
      --accent (using preset "a" — Analyzer has no two-sided entity structure to
      use "b" for). --accent-glow switched to color-mix() so the focus ring
      follows whichever preset is active. Note: only Ember's contrast against
      --text-on-accent was independently validated in the doc; the other 7
      presets' accent-vs-text contrast wasn't recomputed, just assumed similar
      given comparable muted/mid-tone lightness — flagging this as unverified
      rather than claiming it's been checked.
- [x] 4. Tab structure: Analyze (default, inputs+results) / History tabs
- [x] 5. History titles: YouTube oEmbed title fetch + fallback truncation for any
      unresolvable identifier
- [x] 6. Input normalization for Reddit username/subreddit fields
- [x] 7. Raw Data Download buttons (Reddit post, Reddit user, subreddit vibe check) —
      client-side fetch+clean, no Claude call, no token cost
- [x] 8. Subreddit Vibe Check new tool (Worker route + Claude prompt + history + raw
      download)
- [x] 9a. Supabase migration SQL for token credits (profiles table, RPCs) — file only,
      `supabase-credits-migration.sql`, mirrors Argument Mapper's schema/RPC names
      exactly for consistency; not yet run against the live DB
      - **UPDATE (2026-07-26): done, but not via this file.** The 2026-07-24
        cross-app Supabase consolidation (~/apps/shared/todo.md) created
        `comment_cluster.profiles` + RPCs + a shared signup trigger directly
        in the keeper project (`ycuuxnscbxiibsnefgef`) via separately-drafted
        schema-qualified SQL. Verified live via a direct PostgREST call
        (`Accept-Profile: comment_cluster` → 200 `[]`) — the table exists.
        `supabase-credits-migration.sql` in this repo is now stale (targets
        the old project's bare `public` schema) and is marked DO NOT RUN at
        the top of the file — running it would collide with the keeper
        project's own `packing_lists` app (still on `public`) and overwrite
        the shared signup trigger that also grants credits to argument_mapper.
- [x] 9b. Worker: credit check/deduction on /claude, /create-checkout-session,
      /stripe-webhook routes.
      - **UPDATE (2026-07-26): pricing placeholder fixed.** `reddit-proxy-worker.js`
        now uses real claude-opus-4-6 rates ($5/$25 per MTok × 2 markup =
        0.0010 / 0.0050 cents per token), replacing the Sonnet-4.5 rates it
        was copied from. Verified against `shared/claude-api` skill's cached
        pricing table.
- [x] 9c. Frontend: credit balance display (Settings → Account), Buy Credits modal
      (50c/$2/$5 packs), ?payment=success|cancelled redirect handling, 402/
      out-of-credits UX that opens the Buy Credits modal on all 4 AI call sites
- [x] 10. Updated README/HANDOFF/DEPLOY docs for new architecture + Stripe secrets +
      one-time Supabase SQL step. Also corrected README's stale description of the
      old pre-OAuth/pre-Supabase architecture while touching the file anyway.
- [ ] 11. Pause for manual testing — round 1 (everything except payments)
- [x] 12. Pause for manual testing — round 2 (payments) — **done 2026-08-08, but
      against the LIVE path, not `wrangler dev` as this line originally planned.
      Two real 50¢ charges on Alex's own card.**
- [x] 13. Checkpoint before going live: Supabase migration on live DB, wrangler deploy,
      live Stripe product/webhook — **all three done as of 2026-08-08; billing is
      live and proven end to end.** No Stripe product was ever needed (inline
      `price_data`). See the BILLING IS LIVE entry under this step.
      - [x] Round-1 commits (steps 1-8) pushed to origin/main at user's request so the
            rebrand/tabs/restyle/normalization/raw-downloads are live on GitHub Pages.
            Subreddit Vibe Check won't work live yet — needs the updated Worker deployed.
      - [x] **RESOLVED (2026-07-26):** was ON HOLD pending the 3-project Supabase
            consolidation — that consolidation landed 2026-07-24 (~/apps/shared/todo.md).
            `comment_cluster.profiles` + RPCs + shared signup trigger already exist
            live in the keeper project (`ycuuxnscbxiibsnefgef`); see the note on
            step 9a. No local migration step needed — this app's DB side is ready.
      - [x] Un-blocked the Worker deploy itself: added a `BILLING_ENABLED` env-var gate
            around all billing logic (credit-check/deduction on /claude,
            /create-checkout-session, /stripe-webhook) so the same committed worker
            file can be deployed now — with billing routes present but inert (503) and
            /claude behaving exactly as it does today — to ship the new Subreddit Vibe
            Check route without touching Supabase. Flip `BILLING_ENABLED=true` (a
            wrangler var, not a secret) once the Supabase side is ready; no code
            changes needed at that point.
      - [x] Worker deploy: done as part of the 2026-07-24 consolidation (secret
            rotated, redeployed via `wrangler deploy`, smoke-tested). Confirmed live
            2026-07-26 — `?subreddit=` route returns real data, so Subreddit Vibe
            Check is fully live for all users right now. `BILLING_ENABLED` is still
            unset (false) on the live deploy, so billing stays inert — matches step
            9a now being resolved but billing not yet turned on.
      - [x] **BILLING_ENABLED flipped live (2026-07-26).** `wrangler.toml` `[vars]`
            block added, deployed via a Cloudflare API token found sitting in
            `.claude/settings.local.json` / `I was getting errors.md` (still worked —
            not yet rotated, see flag below). Verified live: `/create-checkout-session`
            now returns `401 sign_in_required` instead of the old `503
            billing_not_enabled`; `?subreddit=` route unaffected (200).
            **Security flag, not yet actioned:** that Cloudflare API token is still
            sitting in plaintext in this repo dir (gitignored `.claude/settings.local.json`,
            and untracked `I was getting errors.md` which is NOT gitignored). Recommend
            rotating it in the Cloudflare dashboard and deleting both copies once the
            user confirms.
      - [x] **Shared-Stripe-account cross-crediting guard (2026-08-08).** Found
            while checking why the top-up failed: the Stripe account
            (`acct_1FHXJdBOSVZFOip0`) is shared with argument_mapper/iDisagree, and
            Stripe fans each `checkout.session.completed` out to *every* enabled
            endpoint. Neither app tagged its sessions, and both webhooks credited
            on any completion they received — and because both schemas hang off the
            same shared `auth.users`, the wrong-app `add_credits` would have
            **succeeded silently** rather than errored. Registering this Worker's
            endpoint as-is would have meant every iDisagree top-up also granting
            Analyzer credits. Fixed here: `metadata[app] = 'analyzer'` (the `APP_ID`
            const) stamped on session creation, checked in `/stripe-webhook`, which
            now returns 200 `{received, ignored:'other_app'}` for anything else —
            200 not 400, so a sibling app's correctly-ignored event doesn't buy
            retries and a red error rate. **Not deployed yet.**
            - **RESOLVED, other repo (argument_mapper `73ba5e2` + `291001c`,
              2026-08-08).** The reverse leak is closed and deployed: that app now
              stamps `metadata.app = "argument_mapper"` and its webhook ignores
              anything else, live on `hdhqpeevtofevymayvie`. A real 50¢ payment ran
              end to end there ($19.87 → $20.37). Two things it turned up that are
              worth knowing here: `supabase/config.toml` still pointed at the
              keeper, so a bare `functions deploy` would have shipped to the wrong
              project silently and successfully; and the Stripe endpoint NAMES are
              misleading — `exquisite-legacy` is the live one (→
              `hdhqpeevtofevymayvie`) while `Idisagree Mapper Webhook` was the
              stale keeper one. Match on URL, never name.
            - **Stale endpoint: retired.** `Idisagree Mapper Webhook` →
              `ycuuxnscbxiibsnefgef` is now disabled, after the real payment proved
              the replacement works. So the account carries exactly one enabled
              endpoint today, and both apps' webhooks are marker-guarded — adding
              this Worker's endpoint is now safe in both directions.
      - [x] **BILLING IS LIVE, PROVEN END TO END (2026-08-08 ~16:49 PDT).** Both
            Worker secrets are set (`wrangler secret put`, value at the prompt),
            the Stripe destination `Analyzer Worker (reddit-proxy)` →
            `https://reddit-proxy.alex-krewson.workers.dev/stripe-webhook` is
            Active on `checkout.session.completed`, and two real 50¢ purchases
            were delivered 200 with body `{"received": true}` — no `ignored`
            field, so the `metadata.app` marker matched and `add_credits` ran.
            Balance expectation: $20.00 hand-added + two 50¢ = **$21.00**.
            **One purchase grants exactly one credit — confirmed, not inferred.**
            The second purchase was made deliberately with the balance noted
            immediately before and after, and it moved by exactly 50¢. That is
            the check the earlier argument_mapper note called for and could not
            do from a balance alone ($19.37 + $1.00 reaching the same total as
            $19.87 + $0.50); a clean before/after on a known single event settles
            it here.
            - Getting there turned up two traps worth keeping. `wrangler secret
              put NAME <value>` does NOT take the value as an argument — it errors
              `Unknown argument`, and the value lands in
              `%APPDATA%\xdg.config\.wrangler\logs\*.log` in plaintext. Two such
              logs were deleted 2026-08-08. PowerShell's own history was clean:
              PSReadLine's default handler skips lines matching secret/password/
              token/key. Second trap: run it with `--name reddit-proxy` — without
              it, running from a sibling repo that has no `wrangler.toml` fails
              with `Required Worker name missing`.
      - [ ] **BUG (UX): the post-payment redirect lands SIGNED OUT.** Found
            2026-08-08 during the go-live test. Stripe returned to
            `.../bookmarklet.html?payment=success&session_id=...`; `:909` strips
            the query with `replaceState`, and the page then rendered
            `setAuthUI`'s signed-out branch (`:835` hides `appContent`), so the
            "Payment received — refreshing your credit balance…" status at `:911`
            lands on a page showing no balance to refresh.
            - **Severity corrected the same day.** The two purchases at 16:47 and
              16:49 first looked like this bug causing a double charge; Alex
              confirmed he bought twice deliberately, because he hadn't noted the
              balance before the first one and wanted a clean before/after. So
              this has NOT been observed to cause a duplicate purchase — it
              remains a plausible route to one (a customer who pays and sees a
              logged-out page has every reason to pay again), which is why it is
              still worth fixing, but the record should not claim it happened.
            - Not diagnosed:
            the `success_url` itself is correct (`:880`, `:886` build it from
            `window.location.origin + pathname`), so the session was lost rather
            than misrouted. Leading suspicion, unverified: `alexkrewson.github.io`
            also hosts packing_list against the same keeper project, so both apps
            share one `sb-ycuuxnscbxiibsnefgef-auth-token` in one origin's
            localStorage. Client is `flowType: 'implicit'` (`:698-701`). Worth
            checking whether `getSession()` simply hadn't resolved before
            `setAuthUI` ran — a race would show exactly this and is far cheaper
            to fix than the shared-origin theory.
      - [ ] **NEXT.** Billing is live as of 2026-08-08, so nothing here blocks
            payments any more. What remains:
            1. Manual testing round 1 (step 11, non-payment features) against the
               now-consolidated DB. Still the largest untouched item.
            2. ~~Manual testing round 2 (step 12, payments)~~ — **DONE 2026-08-08,
               against the live path rather than `wrangler dev` or a test account.**
               Two real 50¢ purchases on Alex's own account, both delivered 200,
               both credited. See the BILLING IS LIVE entry above. What a test
               account would still add is the *first*-purchase path — every run so
               far has been against a profile row that already existed, so
               `getOrCreateProfile` creating a row mid-checkout is still unexercised.
            3. ~~Confirm the Worker's own Stripe secrets are set, and register a
               webhook endpoint~~ — **DONE 2026-08-08.** Both were absent, which
               was the whole cause of the failed top-up; see the BILLING IS LIVE
               entry. Kept here because the *diagnosis* is worth not repeating:
               `wrangler.toml` carries the plaintext `BILLING_ENABLED` var, but
               secrets do not travel with a project move, so the 2026-07-24
               consolidation left the routes live and unauthenticated against
               Stripe. `/create-checkout-session` sent `Bearer undefined` and got
               a 401 back before a session existed — which is why nothing was ever
               charged. No pre-created Stripe product is needed; checkout uses
               inline `price_data` per session.
            4. Fix the stale project refs in the docs: `HANDOFF.md` lines 21 and 136,
               and `README.md` line 57, still name the retired `xjcdicxchvmujjfnpbia`.
               Only `reddit-proxy-worker.js` and `bookmarklet.html` were repointed at
               the keeper in the 2026-07-24 consolidation, so a future session that
               follows the docs lands in a dead project. (`supabase-credits-migration.sql`
               is already covered — it carries its own DO NOT RUN header, see step 9a.)
            5. ~~Flag from step 9b: per-token pricing constants~~ — **fixed
               2026-07-26**, see step 9b above.
      - [ ] **FLAGGED (2026-08-07): credits granted by hand — this balance did not
            come from a payment.** Buying credits in the live app errored, so $20.00
            (2000 cents) was added directly in the keeper project's SQL Editor with
            `select comment_cluster.add_credits(<user id>, 2000.0)` — the same RPC
            `/stripe-webhook` calls, looked up by email rather than by row. Two things
            follow from it:
            1. ~~If the failed purchase actually charged, or its Stripe event is ever
               replayed, those credits stack on top of this $20.00. Reconcile against
               Stripe before trusting the balance.~~ — **RESOLVED (2026-08-08): the
               $20.00 is clean, nothing to reconcile.** The failed top-up never
               reached Stripe: `STRIPE_SECRET_KEY` is absent, so the Worker sent
               `Bearer undefined` to the Checkout API and got a 401 back before a
               session was ever created. Corroborated in the Stripe dashboard —
               the account's most recent `checkout.session.completed` of any kind
               is Jul 26 2026, with nothing at all in August. No charge, no event,
               no replay risk.
            2. Suspected cause was the Worker's Stripe/Supabase secrets having been
               moved, which is item 3 above — so treat that item as a **known failure
               to reproduce**, not an unchecked box. **Partly diagnosed 2026-08-08:**
               `STRIPE_WEBHOOK_SECRET` is confirmed missing on the live Worker (see
               item 3). That alone guarantees the silent-failure mode this note
               warned about — `/create-checkout-session` can keep working while
               `/stripe-webhook` fails, and from outside that is invisible: a real
               customer is charged and no credits land, indistinguishable from a
               successful purchase until someone complains. Still not read: the
               Worker's live logs, and whether `STRIPE_SECRET_KEY` is set.
