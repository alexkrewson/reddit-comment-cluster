# Distillery

*(formerly "Reddit Comment Cluster")*

A web app that uses Claude AI to analyze Reddit posts, users, and subreddit culture,
plus YouTube transcripts. Sign in with a magic link to run AI analysis, download raw
data for free, and keep a history of past results.

**Live app:** https://alexkrewson.github.io/reddit-comment-cluster/bookmarklet.html

---

## What it does

### Post Analysis
Paste any Reddit post URL. Distillery fetches every comment, cleans it up, and asks
Claude to:
- Identify all distinct points and arguments made across the comments (not just
  per-comment summaries)
- Cluster similar points into themed groups
- Show what percentage of total discussion each cluster represents
- Format the output as Reddit-ready markdown

### User Analysis
Enter a Reddit username in any format (`u/name`, a profile URL, or just the name).
Distillery fetches account metadata, up to 300 recent comments (3 pages × 100), and up
to 100 recent posts, then asks Claude to analyze the user across four dimensions:
1. **Bot likelihood** — karma ratios, account age, posting patterns, subreddit diversity
2. **Engagement value** — would a discussion with this person be rewarding?
3. **Personality summary** — what can be inferred from their history?
4. **Thinking style** — tribalism, critical thinking, open-mindedness, etc.

### Subreddit Vibe Check
Enter a subreddit in any format (`r/name`, a URL, or just the name). Distillery samples
the month's top posts plus comments from the highest-scoring ones, then asks Claude to
characterize tone, typical topics, engagement style, what performs well, and any norms
or red flags — so you can "know the room" before posting or engaging.

### YouTube Transcripts
Paste a YouTube URL to fetch its transcript (with timestamps) and real video title via
YouTube's oEmbed endpoint. Copy the raw transcript, or send it to Claude for a summary,
key points, and notable quotes.

### Raw Data Downloads
Every Reddit tool (post, user, subreddit) has a free "Download Raw Data" button next to
its AI button. It runs the same fetch-and-clean pipeline but skips Claude entirely,
handing you a plain-text file to paste into any AI of your choice — no tokens spent.

---

## Architecture

| Layer | What | Where |
|---|---|---|
| Frontend | `bookmarklet.html` — single file, no build step | GitHub Pages (static) |
| Reddit/Claude/Stripe proxy | `reddit-proxy-worker.js` | Cloudflare Worker (`reddit-proxy.alex-krewson.workers.dev`) |
| Auth + DB | Supabase project | `ycuuxnscbxiibsnefgef.supabase.co` |

```
Browser (GitHub Pages)
  → Cloudflare Worker
    → Reddit OAuth API (oauth.reddit.com)         [posts, users, subreddits]
    → Anthropic Claude API                        [JWT-gated, credit-metered]
    → Stripe API                                  [checkout sessions, webhook]
    → Supabase REST API                           [credits RPCs, service-role key]
  ← JSON/markdown responses
Browser
  ↔ Supabase (direct)                             [auth, history, own credit balance]
```

**Why the Cloudflare Worker?** The Anthropic API key, Reddit OAuth credentials, and
Stripe secret key can't live in client-side JS. The Worker verifies the caller's
Supabase JWT before forwarding to Claude, deducts credits based on actual token usage,
proxies Reddit's OAuth-gated API, and handles Stripe checkout-session creation plus the
payment webhook — all from one Worker rather than a separate backend.

**Why Reddit OAuth instead of the public JSON API?** Reddit began blocking Cloudflare
datacenter IPs on the public `.json` endpoints; OAuth (`client_credentials` grant)
routes requests through `oauth.reddit.com` and avoids that blocking. See "Known issues"
below.

---

## Auth

- Supabase magic-link (OTP) auth, managed from Settings → Account (top-right gear
  icon). Enter email → receive link → click → logged in.
- Uses **implicit flow** (not PKCE) — PKCE is unreliable on static pages, since the code
  verifier in `localStorage` gets out of sync after sign-out.
- Every tool requires signing in first — AI analysis, raw downloads, and history are
  all tied to the account.

---

## Token-based credits

AI analysis (post, user, subreddit vibe check, YouTube transcript analysis) is
pay-per-token, mirroring the credit system in the sibling app **Argument Mapper**
(iDisagree) for a consistent balance/top-up/deduction experience across both apps. Raw
data downloads are always free since they never call Claude.

- New accounts start with 50¢ in credits (`profiles.credits_cents`).
- Balance shown in Settings → Account; "Buy Credits" opens a modal with 50¢/$2/$5
  packs that redirect to Stripe Checkout in a new tab.
- The Worker's `/claude` route checks the balance before forwarding to Anthropic (402
  `out_of_credits` if empty) and deducts the actual cost afterward based on
  `usage.input_tokens`/`usage.output_tokens` — the response's `X-Credits-Remaining`
  header keeps the displayed balance live without an extra round-trip.
- `/create-checkout-session` and `/stripe-webhook` are Worker routes that call the
  Stripe REST API directly (no SDK) and verify the webhook's `Stripe-Signature` header
  via the Web Crypto HMAC-SHA256 API.

**One-time setup:** run `supabase-credits-migration.sql` once in the Supabase SQL
Editor (creates the `profiles` table, RLS policies, signup trigger, and
`add_credits`/`deduct_credits` RPCs) — the same one-time-migration pattern as the
`analyses` table below.

⚠️ **Before this goes live:** the per-token pricing constants in
`reddit-proxy-worker.js` (`INPUT_CENTS_PER_TOKEN`/`OUTPUT_CENTS_PER_TOKEN`) are
placeholders copied from Argument Mapper's Claude Sonnet 4.5 rates. This app calls
`claude-opus-4-6`, a different and more expensive model — verify and substitute real
Opus pricing before charging real users, or the app will undercharge relative to actual
Anthropic cost.

---

## History

Every analysis run while signed in is saved to a Supabase `analyses` table and shown in
the History tab, with a human-readable title (post title, `u/username`, `r/subreddit`,
or the YouTube video title). Clicking any entry reloads it instantly.

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

## Settings menu

A single gear-icon menu (top right) consolidates:
- **Account** — sign in/out, credit balance, Buy Credits
- **Themes** — 8 accent presets (Classic, Ocean, Sunset, Forest, Dusk, Night,
  Midnight, Ember — Ember is the default), each bundling a dark/light mode with an
  accent color; persists to `localStorage` independent of sign-in state
- **About** — an overlay with a collapsible nav covering each tool, raw downloads,
  history, and privacy
- **Help** — a brief usage pointer

Visual design follows `~/apps/shared/css-best-practices.md` — the dark-first "Ember"
design system shared across every app in that folder (WCAG contrast rules, 44px touch
targets, the repeated-row grid-alignment pattern, component recipes).

---

## Input normalization

Username and subreddit fields accept `u/name`/`r/name`, a full profile/subreddit URL
(any `reddit.com` subdomain), or a bare name, and normalize to just the name — no need
to know or care about the exact format.

---

## Reddit API

The Worker uses Reddit OAuth (`client_credentials` grant) via `oauth.reddit.com`.
Credentials are stored as Cloudflare Worker secrets (`REDDIT_CLIENT_ID`,
`REDDIT_CLIENT_SECRET`).

If Reddit returns 403s: the credentials may have expired. Go to `reddit.com/prefs/apps`,
get fresh credentials, and update secrets via wrangler (see `DEPLOY.md`).

---

## YouTube transcripts

Fetched from a separate Vercel service:
`https://transcriber-alexkrewson-6940s-projects.vercel.app/api/fetch?url=...`

This is a separate project — if transcripts stop working, check that service first.
Video titles come from YouTube's own CORS-enabled oEmbed endpoint, not the transcript
service.

---

## Supported Reddit URL/identifier formats

- Post: standard (`reddit.com/r/sub/comments/abc123/title/`), old Reddit
  (`old.reddit.com/...`), mobile share link (`reddit.com/r/sub/s/TOKEN`), bare post ID
- User/subreddit: `u/name` or `r/name`, a full URL on any `reddit.com` subdomain, or
  just the bare name — see "Input normalization" above

---

## Known issues

### Reddit 403 errors
Reddit blocks unauthenticated requests from Cloudflare datacenter IPs, which is why the
Worker authenticates via OAuth rather than the public JSON API.

**If 403s return:** the OAuth credentials stored as Cloudflare Worker secrets may have
expired or been revoked. To fix:
1. Go to `reddit.com/prefs/apps` and find the app (or create a new "script" type app)
2. Copy the client ID and secret
3. Update the secrets:
   ```bash
   echo "CLIENT_ID" | PATH=~/.nvm/versions/node/v20.20.0/bin:$PATH CLOUDFLARE_API_TOKEN=<token> npx wrangler secret put REDDIT_CLIENT_ID --name reddit-proxy
   echo "CLIENT_SECRET" | PATH=~/.nvm/versions/node/v20.20.0/bin:$PATH CLOUDFLARE_API_TOKEN=<token> npx wrangler secret put REDDIT_CLIENT_SECRET --name reddit-proxy
   ```
4. Redeploy the Worker (see `DEPLOY.md`)

---

## Testing

See `~/apps/shared/testing-guidelines.md` for the full rulebook (three tiers — smoke/
thorough/costly — and how to handle auth, payments, and AI calls). This project's specifics:

- **Live URL**: https://alexkrewson.github.io/reddit-comment-cluster/bookmarklet.html
  — test against this, not a local file, per the shared doc's "test against production"
  rule.
- **Authentication** applies — magic-link/OTP only, no password. Per the shared doc,
  capture an already-authenticated session/storage-state by hand once and reuse it
  rather than scripting the login step.
- **Real AI/LLM calls** apply — every Analyze/Check Vibe action calls Claude. Always
  Costly tier, never Smoke or Thorough.
- **Payments/billing** applies — `BILLING_ENABLED=true` is live on the Worker (see
  `maintenance_todo.md`). Thorough tier covers pricing/plan display, opening the Buy
  Credits modal, and closing it without buying; an actual test purchase is Costly
  tier only, with a test account, per the shared doc's checkout-session caveat.
- **Third-party API integrations without AI cost** apply — the Reddit API (via the
  Cloudflare Worker) and the YouTube transcript fetcher. Exercise by hand rather than
  in a tight automated loop.
- No automated test suite exists yet for this app (see `~/apps/shared/testing-guidelines.md`
  Thorough tier note — manual Playwright MCP pass is the current fallback).

---

## Setup

### Prerequisites
- An [Anthropic API key](https://console.anthropic.com/) (stored as a Worker secret,
  never client-side)
- A [Cloudflare account](https://cloudflare.com/) (free tier)
- A [Supabase project](https://supabase.com/) with magic-link auth enabled
- A [Stripe account](https://stripe.com/) (for token top-ups)
- Node.js v20+ (for deploying the Worker via `wrangler`)

### One-time Supabase setup
Run both migrations once in the SQL Editor: the `analyses` table (History section
above) and `supabase-credits-migration.sql` (Token-based credits section above).

### Cloudflare Worker secrets
```
REDDIT_CLIENT_ID
REDDIT_CLIENT_SECRET
CLAUDE_API_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```
Set via `wrangler secret put <NAME> --name reddit-proxy` (see `DEPLOY.md` for the full
deploy command, including the Node 20 PATH workaround). The Stripe webhook endpoint
should point to `https://reddit-proxy.alex-krewson.workers.dev/stripe-webhook`,
configured for the `checkout.session.completed` event.

### Deploy the frontend
Push `bookmarklet.html` to a GitHub repository with GitHub Pages enabled. Single HTML
file, no build step.
