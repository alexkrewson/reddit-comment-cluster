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
- [x] 9b. Worker: credit check/deduction on /claude, /create-checkout-session,
      /stripe-webhook routes. **Flag before going live**: the per-token pricing
      constants are copied from Argument Mapper's Sonnet-4.5 rates as a
      placeholder — this app calls claude-opus-4-6, a different and pricier
      model, so those constants need updating to real Opus pricing or the app
      will undercharge relative to actual Anthropic cost.
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
      - [ ] **ON HOLD (2026-07-18):** user is planning to consolidate the 3 separate
            Supabase projects (see ~/apps/shared/todo.md) into 1 schema-per-app project
            before this app's Supabase setup gets any more surface area added. Running
            `supabase-credits-migration.sql` against the live `xjcdicxchvmujjfnpbia`
            project now would just mean redoing it against the consolidated project
            later, so it's parked. All step 9 code stays committed locally, unpushed,
            so the live site is unaffected — no Buy Credits button visible until the
            Supabase side is ready. Resume when the consolidation lands (or sooner if
            directed to proceed anyway).
      - [x] Un-blocked the Worker deploy itself: added a `BILLING_ENABLED` env-var gate
            around all billing logic (credit-check/deduction on /claude,
            /create-checkout-session, /stripe-webhook) so the same committed worker
            file can be deployed now — with billing routes present but inert (503) and
            /claude behaving exactly as it does today — to ship the new Subreddit Vibe
            Check route without touching Supabase. Flip `BILLING_ENABLED=true` (a
            wrangler var, not a secret) once the Supabase side is ready; no code
            changes needed at that point.
