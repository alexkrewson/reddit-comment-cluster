const SUPABASE_URL = 'https://xjcdicxchvmujjfnpbia.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YZkXT-j_gaUGKhco7ENJ1Q_ydVit7Nf';

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

  // --- Claude proxy ---
  if (url.pathname === '/claude') {
    const auth = request.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    try {
      await verifySupabaseToken(auth.slice(7));
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Unauthorized: ' + e.message }), { status: 401, headers: corsHeaders });
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

    const result = await claudeResp.text();
    return new Response(result, { status: claudeResp.status, headers: corsHeaders });
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
