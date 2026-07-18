# Analyzer — Maintenance To-Do

Tracking checklist for the Analyzer update spec. Checked off as completed, with a commit
after each step so progress survives a crash. See the approved plan for full rationale.

- [x] 1. Create this maintenance_todo.md
- [x] 2. Rename app "Reddit Comment Cluster" → "Analyzer" (titles/headings/metadata only;
      repo name and GitHub Pages URL stay the same)
- [ ] 3. Visual restyle to match Argument Mapper (light slate/blue palette, font stack,
      dark-mode variant)
- [ ] 4. Tab structure: Analyze (default, inputs+results) / History tabs
- [ ] 5. History titles: YouTube oEmbed title fetch + fallback truncation for any
      unresolvable identifier
- [ ] 6. Input normalization for Reddit username/subreddit fields
- [ ] 7. Raw Data Download buttons (Reddit post, Reddit user, subreddit vibe check) —
      client-side fetch+clean, no Claude call, no token cost
- [ ] 8. Subreddit Vibe Check new tool (Worker route + Claude prompt + history + raw
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
      live Stripe product/webhook, git push — all require explicit go-ahead
