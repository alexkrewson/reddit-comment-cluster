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
- [ ] 12. Pause for manual testing — round 2 (payments, local/wrangler dev only)
- [ ] 13. Checkpoint before going live: Supabase migration on live DB, wrangler deploy,
      live Stripe product/webhook — still require explicit go-ahead
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
      - [ ] **NEXT.** Still needed before real users hit billing:
            1. Manual testing round 1 (step 11, non-payment features) against the
               now-consolidated DB.
            2. Manual testing round 2 (step 12, payments) against `wrangler dev`
               or the now-live billing path, with a test account.
            3. Confirm the Worker's own Stripe secrets (`STRIPE_SECRET_KEY`,
               `STRIPE_WEBHOOK_SECRET` — Cloudflare Worker secrets, separate from
               the Supabase Edge Function secrets argument_mapper uses) are set,
               and register a webhook endpoint in the Stripe dashboard pointing at
               this Worker's `/stripe-webhook` URL. No pre-created Stripe product
               needed — checkout uses inline `price_data`, created ad hoc per session.
            5. ~~Flag from step 9b: per-token pricing constants~~ — **fixed
               2026-07-26**, see step 9b above.
