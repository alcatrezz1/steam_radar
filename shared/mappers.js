// Pure functions that turn raw Steam / SteamSpy / Roblox responses into our shapes.
// Used by the collector (Node) and by the site in live mode (through the proxy).

export const stripHtml = (s = '') =>
  s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();

// Store appdetails response -> store object
export function mapStoreDetails(json, appid) {
  const entry = json?.[appid];
  if (!entry?.success) return { missing: true };
  const d = entry.data;
  const about = stripHtml(d.about_the_game || d.detailed_description || '');
  return {
    type: d.type,
    name: d.name,
    short: stripHtml(d.short_description || ''),
    about: about.length > 1600 ? about.slice(0, 1600).replace(/\s\S*$/, '') + '...' : about,
    header: d.header_image || null,
    capsule: d.capsule_imagev5 || d.capsule_image || null,
    screenshots: (d.screenshots || []).slice(0, 4).map((s) => s.path_thumbnail),
    comingSoon: !!d.release_date?.coming_soon,
    releaseText: d.release_date?.date || '',
    isFree: !!d.is_free,
    price: d.is_free ? 'Free' : d.price_overview?.final_formatted || null,
    categories: (d.categories || []).map((c) => c.description),
    genres: (d.genres || []).map((g) => g.description),
    devs: d.developers || [],
    pubs: d.publishers || [],
    requiredAge: Number(d.required_age) || 0,
    recommendations: d.recommendations?.total ?? null,
  };
}

// "10,000,000 .. 20,000,000" -> { low, high }
export const parseOwners = (s) => {
  const m = String(s || '').replace(/,/g, '').match(/(\d+)\s*\.\.\s*(\d+)/);
  return m ? { low: Number(m[1]), high: Number(m[2]) } : null;
};

// SteamSpy appdetails -> spy object
export function mapSpy(j) {
  if (!j || !j.appid) return { missing: true };
  const tags = Array.isArray(j.tags) ? [] : Object.entries(j.tags || {}).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  return { tags, owners: parseOwners(j.owners), positive: j.positive ?? null, negative: j.negative ?? null };
}

// Roblox omni-search -> list of games
export function mapRobloxSearch(j) {
  const out = [];
  for (const group of j?.searchResults || []) {
    for (const c of group.contents || []) {
      if (c.contentType !== 'Game' || c.isSponsored) continue;
      out.push({
        universeId: c.universeId,
        placeId: c.rootPlaceId,
        name: c.name,
        players: c.playerCount ?? 0,
        upVotes: c.totalUpVotes ?? 0,
        downVotes: c.totalDownVotes ?? 0,
        url: `https://www.roblox.com/games/${c.rootPlaceId}`,
      });
    }
  }
  return out;
}

export const mapRobloxIcons = (j) => Object.fromEntries((j?.data || []).map((d) => [d.targetId, d.imageUrl]));

export const robloxQuery = (steamName) => steamName.replace(/[™®©]/g, '').trim();
