export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
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

async function handleRequest(request, env, corsHeaders) {
    const token = await getAccessToken(env);
    if (!token) {
      return new Response(JSON.stringify({ error: 'Failed to obtain Reddit access token' }), { status: 502, headers: corsHeaders });
    }

    const headers = {
      'Authorization': `bearer ${token}`,
      'User-Agent': 'reddit-comment-cluster/1.0 (by /u/alexkrewson)',
    };

    const url = new URL(request.url);

    // --- User history / about ---
    const user = url.searchParams.get('user');
    const type = url.searchParams.get('type'); // about | comments | submitted
    if (user) {
      const after = url.searchParams.get('after') || '';
      let redditUrl;
      if (type === 'about') {
        redditUrl = `https://oauth.reddit.com/user/${user}/about`;
      } else {
        redditUrl = `https://oauth.reddit.com/user/${user}/${type}?limit=100${after ? '&after=' + after : ''}`;
      }
      const resp = await fetch(redditUrl, { headers });
      const body = await resp.text();
      return new Response(body, { status: resp.status, headers: corsHeaders });
    }

    // --- Post comments ---
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
    const body = await resp.text();
    return new Response(body, { status: resp.status, headers: corsHeaders });
}

async function getAccessToken(env) {
  const credentials = btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`);
  const resp = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'reddit-comment-cluster/1.0 (by /u/alexkrewson)',
    },
    body: 'grant_type=client_credentials',
  });
  if (!resp.ok) return null;
  try {
    const data = await resp.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}
