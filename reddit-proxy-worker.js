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
      return await handleRequest(request, corsHeaders);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Worker exception: ' + e.message }), { status: 500, headers: corsHeaders });
    }
  }
}

async function handleRequest(request, corsHeaders) {
  const headers = {
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
      redditUrl = `https://www.reddit.com/user/${user}/about.json`;
    } else {
      redditUrl = `https://www.reddit.com/user/${user}/${type}.json?limit=100${after ? '&after=' + after : ''}`;
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

  const redditUrl = `https://www.reddit.com/comments/${id}.json?limit=500&raw_json=1`;
  const resp = await fetch(redditUrl, { headers });
  const body = await resp.text();
  return new Response(body, { status: resp.status, headers: corsHeaders });
}
