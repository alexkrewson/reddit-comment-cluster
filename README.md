# Reddit Comment Cluster

A client-side web app that uses Claude AI to analyze Reddit comment threads and user profiles. No server required — runs entirely in the browser, with a lightweight Cloudflare Worker acting as a CORS proxy.

**Live app:** https://alexkrewson.github.io/reddit-comment-cluster/bookmarklet.html

---

## What it does

### Post Analysis
Paste any Reddit post URL. The app fetches all comments, preprocesses them, and sends them to Claude with a prompt asking it to:
- Identify all distinct points and arguments made across the comments (not just per-comment summaries)
- Cluster similar points into themed groups
- Show what percentage of total discussion each cluster represents
- Format the output as Reddit-ready markdown

### User Analysis
Enter a Reddit username. The app fetches their account metadata, up to 300 recent comments (3 pages × 100), and up to 100 recent posts, then asks Claude to analyze the user across four dimensions:
1. **Bot likelihood** — karma ratios, account age, posting patterns, subreddit diversity
2. **Engagement value** — would a discussion with this person be rewarding?
3. **Personality summary** — what can be inferred from their history?
4. **Thinking style** — tribalism, critical thinking, open-mindedness, etc.

---

## How it works

### Data flow

```
Browser (GitHub Pages)
  → Cloudflare Worker (CORS proxy)
    → Reddit public JSON API
  ← JSON response (with CORS headers added)
  → Anthropic Claude API (direct from browser)
  ← Analysis in markdown
```

### Step-by-step for post analysis

1. **URL resolution** — The app parses the pasted URL client-side. Standard Reddit URLs (`/comments/ID/`) have the post ID extracted directly via regex. Reddit mobile share links (`/s/TOKEN`) are passed to the worker, which follows the redirect server-side to resolve the final URL.

2. **Comment fetching** — The worker requests `https://www.reddit.com/comments/{id}.json?limit=500&raw_json=1` and proxies the response back with `Access-Control-Allow-Origin: *`.

3. **Comment preprocessing** — The app recursively flattens the nested comment tree into a flat array. For each comment it:
   - Filters out deleted/removed comments and modteam accounts
   - Strips all URLs from comment bodies
   - Preserves DeltaBot comments (assigns them a score of 1,000,000 so they always appear first)
   - Sorts all comments by score descending

4. **Trimming** — Comments are concatenated into a single text block. If the total exceeds 90,000 characters, lower-scoring comments are dropped (whole comments only — never mid-comment). A note is appended if trimming occurred.

5. **Claude API call** — The preprocessed text and post title are sent directly from the browser to `https://api.anthropic.com/v1/messages` using the `anthropic-dangerous-direct-browser-access` header, which allows browser-side API calls. The model used is `claude-opus-4-6` with a 4,096 token output limit.

6. **Rendering** — The markdown response from Claude is rendered in the browser using the `marked.js` library. A Copy button copies the raw markdown to clipboard (suitable for pasting directly into a Reddit comment).

### Step-by-step for user analysis

1. Three parallel requests to the worker: `about` (account metadata), `comments` (up to 3 pages × 100), `submitted` (1 page × 100)
2. Comment bodies have URLs stripped. Subreddit diversity is computed client-side.
3. Comment history is trimmed to 70,000 characters if needed.
4. All data is assembled into a structured prompt and sent to Claude.

---

## Tech stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Vanilla HTML/CSS/JS | Single-file app, no build step |
| Hosting | GitHub Pages | Static file hosting, free |
| CORS proxy | Cloudflare Workers | Proxies Reddit API requests to bypass browser CORS restrictions |
| Reddit data | Reddit public JSON API | Append `.json` to any Reddit URL — no OAuth required |
| AI | Anthropic Claude API (`claude-opus-4-6`) | Comment clustering and user profiling |
| Markdown rendering | `marked.js` (CDN) | Renders Claude's markdown output in the browser |
| API key storage | `localStorage` | API key persisted per-device, never sent anywhere except Anthropic |

---

## Architecture decisions

**Why Cloudflare Workers?**
Reddit's API does not include `Access-Control-Allow-Origin` headers, so browsers block direct requests from a different domain. The worker acts as a proxy that adds those headers. Cloudflare Workers are free up to 100,000 requests/day — more than enough for personal use.

**Why no OAuth?**
The app originally used Reddit OAuth (`client_credentials` grant) to authenticate API calls. This was removed after Reddit's API policy changes made it unreliable. The public JSON API (`reddit.com/.../.json`) works for all public posts and user profiles without credentials.

**Why call Claude directly from the browser?**
Keeps the architecture simple — no backend needed to relay API calls. The `anthropic-dangerous-direct-browser-access` header opts in to this behavior explicitly. The tradeoff is that the API key is stored in the user's browser, which is acceptable for personal use.

**Why sort by score before trimming?**
The most upvoted comments represent the strongest consensus. Sorting descending before the 90k character cut ensures the highest-signal comments always make it into the analysis, regardless of where they appeared in the thread.

**Why strip URLs?**
URLs consume tokens without adding semantic value to the analysis. Removing them reduces noise and saves context space.

---

## Supported URL formats

- Standard: `https://www.reddit.com/r/sub/comments/abc123/title/`
- Old Reddit: `https://old.reddit.com/r/sub/comments/abc123/`
- Mobile share link: `https://www.reddit.com/r/sub/s/TOKEN`
- Bare post ID: `abc123`

---

## Setup

### Prerequisites
- An [Anthropic API key](https://console.anthropic.com/)
- A [Cloudflare account](https://cloudflare.com/) (free tier)
- Node.js v20+ (for deploying the worker via `wrangler`)

### Deploy the Cloudflare Worker

```bash
npx wrangler deploy reddit-proxy-worker.js --name reddit-proxy --compatibility-date 2024-01-01
```

### Deploy the frontend

Push `bookmarklet.html` to a GitHub repository with GitHub Pages enabled. The app is a single HTML file with no build step.

### Use the app

1. Open the GitHub Pages URL
2. Enter your Anthropic API key — it's saved to `localStorage` and only needs to be entered once per device
3. Paste a Reddit post URL or enter a username
