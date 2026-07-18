const SUPABASE_URL = 'https://xjcdicxchvmujjfnpbia.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YZkXT-j_gaUGKhco7ENJ1Q_ydVit7Nf';

// Token-credit pricing, mirrored from argument_mapper's claude-proxy (2x markup
// over Anthropic's list price).
// !! PLACEHOLDER — these are Claude Sonnet 4.5's per-token rates ($3 / $15 per
// MTok). This app calls `claude-opus-4-6`, a different (materially more
// expensive) model, and its actual per-token cost hasn't been substituted in
// here. Using Sonnet's rates for Opus-tier usage would undercharge relative to
// the real Anthropic bill — verify and update these two constants against
// current claude-opus-4-6 pricing before this goes live.
const INPUT_CENTS_PER_TOKEN = 0.000_6;  // $3 / MTok × 2 (Sonnet 4.5 rate — see note above)
const OUTPUT_CENTS_PER_TOKEN = 0.003_0; // $15 / MTok × 2 (Sonnet 4.5 rate — see note above)

let cachedToken = null;
let tokenExpiry = 0;

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    const corsHeaders = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    };

    try {
      return await handleRequest(request, env, corsHeaders);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Worker exception: ' + e.message }), { status: 500, headers: corsHeaders });
    }
  }
}

async function verifySupabaseToken(token) {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': SUPABASE_ANON_KEY,
    },
  });
  if (!resp.ok) throw new Error('Invalid or expired token');
  return resp.json();
}

// --- Credits (Supabase `profiles` table + RPCs, via service-role key so RLS
// doesn't block the Worker's own reads/writes) ---

async function getOrCreateProfile(userId, env) {
  const headers = {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
  const selectResp = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=credits_cents`,
    { headers }
  );
  const rows = await selectResp.json();
  if (Array.isArray(rows) && rows.length) return rows[0].credits_cents;

  const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ id: userId }),
  });
  const created = await insertResp.json();
  return Array.isArray(created) && created.length ? created[0].credits_cents : 0;
}

async function callCreditsRpc(fn, userId, amount, env) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_user_id: userId, p_amount: amount }),
  });
  if (!resp.ok) throw new Error(`${fn} failed (${resp.status}): ${await resp.text()}`);
  return resp.json();
}

// --- Stripe webhook signature verification (Web Crypto — no Stripe SDK) ---
async function verifyStripeSignature(payload, sigHeader, secret) {
  const parts = Object.fromEntries((sigHeader || '').split(',').map((p) => p.split('=')));
  if (!parts.t || !parts.v1) throw new Error('Malformed Stripe-Signature header');

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(parts.t, 10)) > 300) throw new Error('Timestamp outside tolerance');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${parts.t}.${payload}`));
  const expected = Array.from(new Uint8Array(sigBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
  if (expected !== parts.v1) throw new Error('Signature mismatch');
}

async function getAccessToken(env) {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) return cachedToken;

  const credentials = btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`);
  const resp = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'cloudflare-worker:reddit-comment-cluster:1.0 (by /u/alexkrewson)',
    },
    body: 'grant_type=client_credentials',
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token fetch failed (${resp.status}): ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  if (!data.access_token) throw new Error('No access_token: ' + JSON.stringify(data));

  cachedToken = data.access_token;
  tokenExpiry = now + (data.expires_in - 300) * 1000;
  return cachedToken;
}

async function handleRequest(request, env, corsHeaders) {
  const url = new URL(request.url);

  // --- Claude proxy (token-metered — see /claude credit check below) ---
  if (url.pathname === '/claude') {
    const auth = request.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    let user;
    try {
      user = await verifySupabaseToken(auth.slice(7));
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Unauthorized: ' + e.message }), { status: 401, headers: corsHeaders });
    }

    const credits = await getOrCreateProfile(user.id, env);
    if (credits <= 0) {
      return new Response(JSON.stringify({ error: 'out_of_credits', credits }), { status: 402, headers: corsHeaders });
    }

    const body = await request.text();
    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body,
    });

    const resultText = await claudeResp.text();
    let creditsRemaining = credits;
    if (claudeResp.ok) {
      try {
        const usage = JSON.parse(resultText).usage;
        if (usage) {
          const cost = usage.input_tokens * INPUT_CENTS_PER_TOKEN + usage.output_tokens * OUTPUT_CENTS_PER_TOKEN;
          creditsRemaining = await callCreditsRpc('deduct_credits', user.id, cost, env);
        }
      } catch (e) {
        // Don't fail the response if deduction bookkeeping errors — the user
        // already got their answer; a bookkeeping miss is cheaper than a
        // false error on a successful analysis.
      }
    }

    return new Response(resultText, {
      status: claudeResp.status,
      headers: {
        ...corsHeaders,
        'Access-Control-Expose-Headers': 'X-Credits-Remaining',
        'X-Credits-Remaining': String(creditsRemaining),
      },
    });
  }

  // --- Stripe: create a Checkout session for a credit top-up ---
  if (url.pathname === '/create-checkout-session' && request.method === 'POST') {
    const auth = request.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'sign_in_required' }), { status: 401, headers: corsHeaders });
    }
    let user;
    try {
      user = await verifySupabaseToken(auth.slice(7));
    } catch (e) {
      return new Response(JSON.stringify({ error: 'sign_in_required' }), { status: 401, headers: corsHeaders });
    }

    const { amount_cents, success_url, cancel_url } = await request.json();
    if (!amount_cents || amount_cents < 50) {
      return new Response(JSON.stringify({ error: 'Minimum purchase is 50 cents' }), { status: 400, headers: corsHeaders });
    }

    const defaultUrl = 'https://alexkrewson.github.io/reddit-comment-cluster/bookmarklet.html';
    const params = new URLSearchParams();
    params.append('payment_method_types[0]', 'card');
    params.append('line_items[0][price_data][currency]', 'usd');
    params.append('line_items[0][price_data][product_data][name]', 'Analyzer AI Credits');
    params.append(
      'line_items[0][price_data][product_data][description]',
      `${amount_cents >= 100 ? '$' + (amount_cents / 100).toFixed(2) : amount_cents + '¢'} of AI processing credits`
    );
    params.append('line_items[0][price_data][unit_amount]', String(amount_cents));
    params.append('line_items[0][quantity]', '1');
    params.append('mode', 'payment');
    params.append('success_url', success_url || `${defaultUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', cancel_url || `${defaultUrl}?payment=cancelled`);
    params.append('client_reference_id', user.id);
    params.append('metadata[user_id]', user.id);
    params.append('metadata[credits_cents]', String(amount_cents));

    const stripeResp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const session = await stripeResp.json();
    if (!stripeResp.ok) {
      return new Response(JSON.stringify({ error: session.error?.message || 'Stripe error' }), { status: stripeResp.status, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: corsHeaders });
  }

  // --- Stripe: webhook for completed checkouts (adds credits) ---
  if (url.pathname === '/stripe-webhook' && request.method === 'POST') {
    const sig = request.headers.get('stripe-signature');
    if (!sig || !env.STRIPE_WEBHOOK_SECRET) {
      return new Response('Missing signature or webhook secret', { status: 400 });
    }
    const rawBody = await request.text();
    try {
      await verifyStripeSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (e) {
      return new Response('Webhook signature verification failed: ' + e.message, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id;
      const creditsCents = parseFloat(session.metadata?.credits_cents ?? '0');
      if (!userId || creditsCents <= 0) {
        return new Response('Missing user_id or credits_cents in session metadata', { status: 400 });
      }
      try {
        await callCreditsRpc('add_credits', userId, creditsCents, env);
      } catch (e) {
        return new Response('Failed to add credits: ' + e.message, { status: 500 });
      }
    }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // --- Reddit routes ---
  const token = await getAccessToken(env);
  const headers = {
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'cloudflare-worker:reddit-comment-cluster:1.0 (by /u/alexkrewson)',
  };

  const user = url.searchParams.get('user');
  const type = url.searchParams.get('type');
  if (user) {
    const after = url.searchParams.get('after') || '';
    let redditUrl;
    if (type === 'about') {
      redditUrl = `https://oauth.reddit.com/user/${user}/about`;
    } else {
      redditUrl = `https://oauth.reddit.com/user/${user}/${type}?limit=100${after ? '&after=' + after : ''}`;
    }
    const resp = await fetch(redditUrl, { headers });
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: 'Reddit returned ' + resp.status }), { status: resp.status, headers: corsHeaders });
    }
    const body = await resp.text();
    return new Response(body, { status: resp.status, headers: corsHeaders });
  }

  // --- Subreddit Vibe Check: top posts, or comments for one post via &id= ---
  const subreddit = url.searchParams.get('subreddit');
  if (subreddit) {
    const listing = url.searchParams.get('listing') || 'top';
    const redditUrl = `https://oauth.reddit.com/r/${encodeURIComponent(subreddit)}/${listing}?limit=25&t=month&raw_json=1`;
    const resp = await fetch(redditUrl, { headers });
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: 'Reddit returned ' + resp.status }), { status: resp.status, headers: corsHeaders });
    }
    const body = await resp.text();
    return new Response(body, { status: resp.status, headers: corsHeaders });
  }

  let id = url.searchParams.get('id');
  const rawUrl = url.searchParams.get('url');

  if (!id && rawUrl) {
    let resolved = rawUrl;
    if (rawUrl.includes('/s/')) {
      const r = await fetch(rawUrl, { redirect: 'follow', headers });
      resolved = r.url;
    }
    const m = resolved.match(/\/comments\/([A-Za-z0-9]+)/);
    if (m) id = m[1];
  }

  if (!id) return new Response(JSON.stringify({ error: 'Missing required parameter' }), { status: 400, headers: corsHeaders });

  const redditUrl = `https://oauth.reddit.com/comments/${id}?limit=500&raw_json=1`;
  const resp = await fetch(redditUrl, { headers });
  if (!resp.ok) {
    return new Response(JSON.stringify({ error: 'Reddit returned ' + resp.status }), { status: resp.status, headers: corsHeaders });
  }
  const body = await resp.text();
  return new Response(body, { status: resp.status, headers: corsHeaders });
}
