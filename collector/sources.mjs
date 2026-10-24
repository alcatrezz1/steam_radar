// Raw data sources. Fetching lives here, parsing lives in shared/mappers.js.
import { get, sleep } from './net.mjs';
import { mapStoreDetails, mapSpy, mapRobloxSearch, mapRobloxIcons } from '../shared/mappers.js';

// ---------- Steam: seeds ----------

// Top ~100 games by current players (official Steam charts).
export async function steamMostPlayed() {
  const j = await get('https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/');
  return (j?.response?.ranks || []).map((r) => ({ appid: r.appid }));
}

// Steam store search lists: 'popularwishlist', 'popularcomingsoon', 'popularnew', 'topsellers'.
// Returns appids in store order. category1=998 keeps games only.
export async function steamSearchList(filter, total) {
  const ids = [];
  for (let start = 0; start < total; start += 50) {
    const url = `https://store.steampowered.com/search/results/?filter=${filter}&infinite=1&start=${start}&count=50&category1=998&cc=us&l=english`;
    const j = await get(url);
    const found = [...(j?.results_html || '').matchAll(/data-ds-appid="(\d+)"/g)].map((m) => Number(m[1]));
    if (!found.length) break;
    for (const id of found) if (!ids.includes(id)) ids.push(id);
    await sleep(1500);
  }
  return ids;
}

// ---------- Steam: per game ----------

export async function steamPlayers(appid) {
  const j = await get(`https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appid}`, { retries: 1 });
  return j?.response?.result === 1 ? j.response.player_count : null;
}

export async function steamStoreDetails(appid) {
  const j = await get(`https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us&l=english`, { backoff: 60000 });
  return mapStoreDetails(j, appid);
}

// Followers of the game's Steam community hub. Used to estimate wishlists.
export async function steamFollowers(appid) {
  const xml = await get(`https://steamcommunity.com/games/${appid}/memberslistxml/?xml=1`, { as: 'text', retries: 1 });
  const m = xml.match(/<\/groupDetails>\s*<memberCount>(\d+)<\/memberCount>/) || xml.match(/<memberCount>(\d+)<\/memberCount>/);
  return m ? Number(m[1]) : null;
}

// ---------- SteamSpy ----------

export async function spyTop(request) {
  const j = await get(`https://steamspy.com/api.php?request=${request}`);
  return Object.values(j || {}).map((g) => ({ appid: g.appid, ccu: g.ccu ?? null }));
}

export async function spyTag(tag) {
  const j = await get(`https://steamspy.com/api.php?request=tag&tag=${encodeURIComponent(tag)}`, { retries: 1, backoff: 61000 });
  return Object.values(j || {});
}

export async function spyDetails(appid) {
  return mapSpy(await get(`https://steamspy.com/api.php?request=appdetails&appid=${appid}`, { retries: 1 }));
}

// ---------- Roblox ----------

export async function robloxSearch(query) {
  const session = Math.random().toString(36).slice(2);
  return mapRobloxSearch(await get(
    `https://apis.roblox.com/search-api/omni-search?searchQuery=${encodeURIComponent(query)}&sessionId=${session}&pageType=all`,
    { retries: 1 },
  ));
}

export async function robloxIcons(universeIds) {
  if (!universeIds.length) return {};
  return mapRobloxIcons(await get(
    `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeIds.join(',')}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`,
    { retries: 1 },
  ));
}
