# Distillery — Handoff Notes

*(formerly "Reddit Comment Cluster")*

## What this app is

A single-page web app that analyzes Reddit posts, Reddit users, subreddits (Vibe Check), and YouTube transcripts using Claude, with tabbed Analyze/History UI, a consolidated Settings menu (Account/Themes/About/Help), and token-based credits for AI analysis (raw data downloads stay free). Lives at:

**https://alexkrewson.github.io/reddit-comment-cluster/bookmarklet.html**

The only file that matters for the frontend is `bookmarklet.html` in the root of this repo. Deploying = commit + push to `main`.

---

## Architecture

| Layer | What | Where |
|---|---|---|
| Frontend | `bookmarklet.html` | GitHub Pages (static) |
| Reddit/Claude/Stripe proxy | `reddit-proxy-worker.js` | Cloudflare Worker (`reddit-proxy.alex-krewson.workers.dev`) |
| Auth + DB | Supabase project | `ycuuxnscbxiibsnefgef.supabase.co` |

**Why the Cloudflare Worker?** The Claude API key, Reddit OAuth credentials, and Stripe secret key can't live in client-side JS. The worker verifies the user's Supabase JWT before forwarding requests to Claude (and checks/deducts token credits), proxies Reddit API calls, resolves Reddit share/mobile links, and handles Stripe checkout-session creation + the payment webhook.

**Architecture decision (2026-07-18):** rather than adding Supabase Edge Functions (Deno) as a second backend runtime just for billing — which is how the sibling app Argument Mapper does it — billing was folded into this same Worker as three new routes (`/create-checkout-session`, `/stripe-webhook`, plus credit-check/deduction on `/claude`), calling the Stripe REST API directly with `fetch` and verifying webhook signatures via the Web Crypto API. Keeps one backend instead of two, reusing the existing JWT-verification helper.

---

## Auth

- Supabase magic-link (OTP) auth. Users enter email → receive link → click → logged in.
- Uses **implicit flow** (not PKCE). PKCE is unreliable on static pages — the code verifier in localStorage gets out of sync after sign-out. Implicit flow is correct here.
- `emailRedirectTo` is locked to `window.location.origin + window.location.pathname` (strips any stale hash/query params that could cause redirect URL mismatches).
- Rate limit: Supabase free tier throttles OTP sends per IP. During normal use (one login per session) this is never a problem. Don't hammer it during testing.

---

## History feature (added May 2026)

Every successful analysis is saved to a Supabase `analyses` table and shown in a "Recent analyses" list when logged in. Clicking any entry replays the result instantly.

**Four saved types:**
- `reddit_post` — Claude analysis of a Reddit post's comments
- `reddit_user` — Claude analysis of a Reddit user profile
- `youtube_transcript` — raw transcript fetched from the transcriber service
- `youtube_analysis` — Claude analysis of a YouTube transcript

### Supabase table (must exist — run once in SQL Editor)

```sql
create table analyses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  type text not null,
  query text not null,
  title text not null,
  meta text,
  result text not null,
  created_at timestamptz default now()
);

alter table analyses enable row level security;

create policy "select own analyses"
  on analyses for select
  using (auth.uid() = user_id);

create policy "insert own analyses"
  on analyses for insert
  with check (auth.uid() = user_id);
```

---

## Token-based credits (added July 2026)

AI analysis (post, user, subreddit vibe check, YouTube transcript analysis) costs
credits; raw data downloads never call Claude and stay free. Mirrors Argument Mapper's
credit system for a consistent balance/top-up/deduction experience.

- **Migration:** `supabase-credits-migration.sql` — run once in the SQL Editor. Creates
  `profiles` (per-user `credits_cents`, defaults to 50¢ starter credits via a signup
  trigger), RLS scoped to `auth.uid()`, and `add_credits`/`deduct_credits` RPCs.
- **Worker routes:**
  - `/claude` — checks `profiles.credits_cents` before forwarding to Anthropic (402
    `out_of_credits` if empty), deducts the real cost afterward from
    `usage.input_tokens`/`usage.output_tokens`, returns the new balance via an
    `X-Credits-Remaining` response header.
  - `/create-checkout-session` — JWT-verified, creates a Stripe Checkout session via a
    direct REST call (50¢/$2/$5 packs from the frontend, 50¢ minimum enforced
    server-side).
  - `/stripe-webhook` — verifies `Stripe-Signature` manually (HMAC-SHA256 via Web
    Crypto, since there's no Stripe SDK in a Worker), calls `add_credits` on
    `checkout.session.completed`.
- **Frontend:** balance shown in Settings → Account, refreshed from
  `X-Credits-Remaining` after every analysis; Buy Credits modal opens Stripe Checkout
  in a new tab; a 402 response opens the same modal instead of a generic error.

**Pricing constants — resolved 2026-07-26.** `INPUT_CENTS_PER_TOKEN`/`OUTPUT_CENTS_PER_TOKEN`
in `reddit-proxy-worker.js` are real `claude-opus-4-6` rates ($5/$25 per MTok × 2 markup
= 0.0010 / 0.0050 cents per token). They were briefly Sonnet-4.5 rates copied from Argument
Mapper, which would have undercharged every analysis; that is fixed and this paragraph is
kept so nobody re-opens it.

**Billing is live and proven end to end (2026-08-08).** Two real 50¢ purchases were
delivered 200 and credited, with the balance noted immediately before and after the second
one — so "one purchase grants exactly one credit" is confirmed, not inferred.

---

## Reddit API

The worker uses Reddit OAuth (`client_credentials` grant) via `oauth.reddit.com`. Credentials are stored as Cloudflare Worker secrets (`REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`).

If Reddit returns 403s: the credentials may have expired. Go to `reddit.com/prefs/apps`, get fresh credentials, and update secrets via wrangler (see `DEPLOY.md`).

**History:** originally used the public JSON API (`www.reddit.com/.../.json`). By April 2026 Reddit began blocking Cloudflare datacenter IPs on the public API, requiring the switch back to OAuth.

---

## YouTube transcripts

Fetched from a separate Vercel service:
`https://transcriber-alexkrewson-6940s-projects.vercel.app/api/fetch?url=...`

This is a separate project — if transcripts stop working, check that service first.

---

## Cloudflare Worker deployment

See `DEPLOY.md`. Requires Node 20 and a Cloudflare API token (not `wrangler login` — use token auth on remote). No `wrangler.toml` is committed; config is inlined in the deploy command.

---

## Key environment values

| Thing | Value |
|---|---|
| Supabase URL | `https://ycuuxnscbxiibsnefgef.supabase.co` |
| Supabase anon key | `sb_publishable_oVIOiEk8gNhTfczh2W86bA_f1NnEsCF` |
| Worker URL | `https://reddit-proxy.alex-krewson.workers.dev` |
| GitHub repo | `alexkrewson/reddit-comment-cluster` |

### Cloudflare Worker secrets (set via `wrangler secret put <NAME> --name reddit-proxy`)

| Secret | Purpose |
|---|---|
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | Reddit OAuth (existing) |
| `CLAUDE_API_KEY` | Anthropic API (existing) |
| `SUPABASE_SERVICE_ROLE_KEY` | New — lets the Worker read/write `profiles` bypassing RLS |
| `STRIPE_SECRET_KEY` | New — Stripe REST API calls (checkout session creation) |
| `STRIPE_WEBHOOK_SECRET` | New — verifies the `Stripe-Signature` header on `/stripe-webhook` |

Stripe webhook endpoint should point to
`https://reddit-proxy.alex-krewson.workers.dev/stripe-webhook`, subscribed to
`checkout.session.completed`.

---

## Possible future work

- Delete history entries from the UI
- Pagination or search for history (currently shows last 30)
- Display YouTube transcripts in the transcript box (with timestamps) when loaded from history, instead of plain text in the output panel
- Deduplicate history (don't save a new entry if the same URL was analyzed recently)
- **Verify/replace the placeholder claude-opus-4-6 pricing constants** in
  `reddit-proxy-worker.js` before real users can spend real money on credits (see
  "Token-based credits" above)
- Independently verify WCAG contrast for the 7 non-Ember theme presets (only Ember's
  was validated in `~/apps/shared/css-best-practices.md`)
