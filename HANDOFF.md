# Analyzer — Handoff Notes

*(formerly "Reddit Comment Cluster")*

## What this app is

A single-page web app that analyzes Reddit posts, Reddit users, subreddits, and YouTube transcripts using Claude. Lives at:

**https://alexkrewson.github.io/reddit-comment-cluster/bookmarklet.html**

The only file that matters for the frontend is `bookmarklet.html` in the root of this repo. Deploying = commit + push to `main`.

---

## Architecture

| Layer | What | Where |
|---|---|---|
| Frontend | `bookmarklet.html` | GitHub Pages (static) |
| Claude proxy | `reddit-proxy-worker.js` | Cloudflare Worker (`reddit-proxy.alex-krewson.workers.dev`) |
| Auth + DB | Supabase project | `xjcdicxchvmujjfnpbia.supabase.co` |

**Why the Cloudflare Worker?** The Claude API key can't live in client-side JS. The worker verifies the user's Supabase JWT before forwarding requests to Claude. It also proxies Reddit API calls (which require OAuth credentials) and resolves Reddit share/mobile links.

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
| Supabase URL | `https://xjcdicxchvmujjfnpbia.supabase.co` |
| Supabase anon key | `sb_publishable_YZkXT-j_gaUGKhco7ENJ1Q_ydVit7Nf` |
| Worker URL | `https://reddit-proxy.alex-krewson.workers.dev` |
| GitHub repo | `alexkrewson/reddit-comment-cluster` |

---

## Possible future work

- Delete history entries from the UI
- Pagination or search for history (currently shows last 30)
- Display YouTube transcripts in the transcript box (with timestamps) when loaded from history, instead of plain text in the output panel
- Deduplicate history (don't save a new entry if the same URL was analyzed recently)
