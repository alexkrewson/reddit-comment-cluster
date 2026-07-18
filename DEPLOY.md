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

**"Reddit returned 403"** — Reddit is rate-limiting or blocking the worker's IP. Nothing to deploy; wait and retry. If this starts happening frequently, the next step is to implement Reddit OAuth so requests come from an authenticated app rather than anonymous Cloudflare IPs — see the "Known issues" section in README.md.

## Worker secrets (added July 2026 — token-based billing)

Three new secrets are needed for the `/create-checkout-session`, `/stripe-webhook`,
and credit-metered `/claude` routes, on top of the existing `REDDIT_CLIENT_ID`,
`REDDIT_CLIENT_SECRET`, and `CLAUDE_API_KEY`:

```bash
echo "<service-role-key>" | PATH=~/.nvm/versions/node/v20.20.0/bin:$PATH CLOUDFLARE_API_TOKEN=<token> npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name reddit-proxy
echo "<stripe-secret-key>" | PATH=~/.nvm/versions/node/v20.20.0/bin:$PATH CLOUDFLARE_API_TOKEN=<token> npx wrangler secret put STRIPE_SECRET_KEY --name reddit-proxy
echo "<stripe-webhook-signing-secret>" | PATH=~/.nvm/versions/node/v20.20.0/bin:$PATH CLOUDFLARE_API_TOKEN=<token> npx wrangler secret put STRIPE_WEBHOOK_SECRET --name reddit-proxy
```

- `SUPABASE_SERVICE_ROLE_KEY`: Supabase dashboard → Project Settings → API → `service_role` key (not the anon key — this one bypasses RLS, keep it server-side only).
- `STRIPE_SECRET_KEY`: Stripe dashboard → Developers → API keys.
- `STRIPE_WEBHOOK_SECRET`: created when you add the webhook endpoint (next step) — Stripe shows the signing secret once the endpoint is created.

## One-time Stripe webhook setup

In the Stripe dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://reddit-proxy.alex-krewson.workers.dev/stripe-webhook`
- Event: `checkout.session.completed`

Copy the signing secret shown after creation into `STRIPE_WEBHOOK_SECRET` above.

## One-time Supabase migration

Run `supabase-credits-migration.sql` once in the Supabase SQL Editor (creates
`profiles`, RLS, the signup trigger, and the `add_credits`/`deduct_credits` RPCs) —
same one-time pattern as the `analyses` table setup in HANDOFF.md.

⚠️ Before any of this touches real payments: the per-token pricing constants in
`reddit-proxy-worker.js` are placeholders (Sonnet 4.5 rates, not the `claude-opus-4-6`
this app actually calls) — see HANDOFF.md's "Token-based credits" section.
