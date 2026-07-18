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
- [ ] 9a. Supabase migration SQL for token credits (profiles table, RPCs) — file only
- [ ] 9b. Worker: credit check/deduction on /claude, /create-checkout-session,
      /stripe-webhook routes
- [ ] 9c. Frontend: credit balance display, Buy Credits modal, payment redirect handling,
      402/out-of-credits UX
- [ ] 10. Update README/HANDOFF/DEPLOY docs for new architecture + Stripe secrets +
      one-time Supabase SQL step
- [ ] 11. Pause for manual testing — round 1 (everything except payments)
- [ ] 12. Pause for manual testing — round 2 (payments, local/wrangler dev only)
- [ ] 13. Checkpoint before going live: Supabase migration on live DB, wrangler deploy,
      live Stripe product/webhook — still require explicit go-ahead
      - [x] Round-1 commits (steps 1-8) pushed to origin/main at user's request so the
            rebrand/tabs/restyle/normalization/raw-downloads are live on GitHub Pages.
            Subreddit Vibe Check won't work live yet — needs the updated Worker deployed.
