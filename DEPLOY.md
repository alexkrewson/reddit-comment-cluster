# Deploying the Cloudflare Worker

The app has two parts:
- **GitHub Pages** (`bookmarklet.html`) — deploys automatically on `git push`
- **Cloudflare Worker** (`reddit-proxy-worker.js`) — must be deployed manually via Wrangler

The worker is a CORS proxy. Browsers block direct requests to Reddit's API from GitHub Pages, so the worker sits in between.

## Why this is annoying

The server (`CF-53-2`) runs Node.js v18, but Wrangler requires v20+. Node 20 is installed via nvm but doesn't activate automatically in non-interactive shells.

## Deploy command

```bash
cd ~/apps/comment_cluster_claude && PATH=~/.nvm/versions/node/v20.20.0/bin:$PATH CLOUDFLARE_API_TOKEN=<token> npx wrangler deploy
```

Get a token at: **dash.cloudflare.com/profile/api-tokens** → Create Token → "Edit Cloudflare Workers" template

## When to redeploy

Only needed when `reddit-proxy-worker.js` changes. Changes to `bookmarklet.html` go live automatically via GitHub Pages on push.

## Troubleshooting

**"Wrangler requires at least Node.js v20"** — The PATH prefix above is missing. Use the full command above, not just `npx wrangler deploy`.

**"Reddit returned 403"** — Reddit is rate-limiting or blocking the worker's IP. Nothing to deploy; wait and retry.
