// Steam Radar proxy, a Cloudflare Worker.
// Steam and Roblox block requests from other websites (CORS), so the site asks this worker instead.
// Only the routes below are allowed, and only from the origins in ALLOWED_ORIGINS.
//
// Deploy: Cloudflare dashboard -> Workers & Pages -> Create -> Worker -> paste this file -> Deploy.

const ALLOWED_ORIGINS = [
  'https://alcatrezz1.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const enc = encodeURIComponent;
const appid = (p) => {
  const id = p.get('id') || '';
  if (!/^\d{1,10}$/.test(id)) throw new Error('bad id');
  return id;
};
const query = (p) => {
  const q = (p.get('q') || '').trim();
  if (q.length < 2 || q.length > 80) throw new Error('bad query');
  return q;
};

// route -> { url, ttl (seconds to cache), transform? }
const ROUTES = {
  search: (p) => ({ url: `https://store.steampowered.com/api/storesearch/?term=${enc(query(p))}&l=english&cc=US`, ttl: 3600 }),
  app: (p) => ({ url: `https://store.steampowered.com/api/appdetails?appids=${appid(p)}&cc=us&l=english`, ttl: 6 * 3600 }),
  players: (p) => ({
    url: `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid(p)}`,
    ttl: 300,
    transform: async (res) => {
      const j = await res.json();
      return { count: j?.response?.result === 1 ? j.response.player_count : null };
    },
  }),
  spy: (p) => ({ url: `https://steamspy.com/api.php?request=appdetails&appid=${appid(p)}`, ttl: 24 * 3600 }),
  followers: (p) => ({
    url: `https://steamcommunity.com/games/${appid(p)}/memberslistxml/?xml=1`,
    ttl: 24 * 3600,
    transform: async (res) => {
      const xml = await res.text();
      const m = xml.match(/<\/groupDetails>\s*<memberCount>(\d+)<\/memberCount>/) || xml.match(/<memberCount>(\d+)<\/memberCount>/);
      return { count: m ? Number(m[1]) : null };
    },
  }),
  roblox: (p) => ({
    url: `https://apis.roblox.com/search-api/omni-search?searchQuery=${enc(query(p))}&sessionId=${crypto.randomUUID()}&pageType=all`,
    ttl: 24 * 3600,
  }),
  icons: (p) => {
    const ids = (p.get('ids') || '').split(',').filter((s) => /^\d{1,15}$/.test(s)).slice(0, 10);
    if (!ids.length) throw new Error('bad ids');
    return {
      url: `https://thumbnails.roblox.com/v1/games/icons?universeIds=${ids.join(',')}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`,
      ttl: 24 * 3600,
    };
  },
};

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  Vary: 'Origin',
});

const json = (body, status, origin, ttl = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttl}`, ...(origin ? cors(origin) : {}) },
  });

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    const allowed = origin && ALLOWED_ORIGINS.includes(origin);
    if (!allowed) return json({ error: 'origin not allowed' }, 403, null);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405, origin);

    const url = new URL(request.url);
    const route = ROUTES[url.pathname.replace(/^\/+|\/+$/g, '')];
    if (!route) return json({ error: 'unknown route' }, 404, origin);

    let target;
    try {
      target = route(url.searchParams);
    } catch (e) {
      return json({ error: e.message }, 400, origin);
    }

    // Shared edge cache, keyed by the upstream URL (the Roblox session id is stripped so repeats hit the cache).
    const cacheKey = new Request(target.url.replace(/&sessionId=[^&]+/, ''));
    const cache = caches.default;
    const hit = await cache.match(cacheKey);
    if (hit) {
      const body = await hit.text();
      return new Response(body, { headers: { 'Content-Type': 'application/json', ...cors(origin), 'X-Cache': 'HIT' } });
    }

    const upstream = await fetch(target.url, { headers: { 'User-Agent': 'SteamRadar/1.0', Accept: 'application/json, text/xml' } });
    if (!upstream.ok) return json({ error: `upstream ${upstream.status}` }, 502, origin);

    const data = target.transform ? await target.transform(upstream) : await upstream.json();
    const body = JSON.stringify(data);
    ctx.waitUntil(cache.put(cacheKey, new Response(body, { headers: { 'Cache-Control': `public, max-age=${target.ttl}` } })));
    return new Response(body, { headers: { 'Content-Type': 'application/json', ...cors(origin), 'X-Cache': 'MISS' } });
  },
};
