import { DATA, PROXY } from './config';
import type { GameDetail, Lists, SearchHit } from './types';
import { mapStoreDetails, mapSpy, mapRobloxSearch, mapRobloxIcons, robloxQuery } from '../../../shared/mappers.js';
import { looksLikeCopy } from '../../../shared/scoring.js';
import { gameMetrics } from '../../../shared/metrics.js';

const getJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
};

let listsP: Promise<Lists> | null = null;
export const loadLists = () => (listsP ||= getJson<Lists>(`${DATA}/lists.json`));

let indexP: Promise<[number, string][]> | null = null;
export const loadIndex = () => (indexP ||= getJson<[number, string][]>(`${DATA}/index.json`).catch(() => []));

const gameCache = new Map<number, Promise<GameDetail>>();

// Tracked games come from the static JSON. Others are fetched live through the proxy.
export function loadGame(appid: number): Promise<GameDetail> {
  if (!gameCache.has(appid)) {
    const p = getJson<GameDetail>(`${DATA}/games/${appid}.json`).catch((e) => {
      if (PROXY) return liveGame(appid);
      throw e;
    });
    p.catch(() => gameCache.delete(appid));
    gameCache.set(appid, p);
  }
  return gameCache.get(appid)!;
}

const proxy = <T,>(path: string) => getJson<T>(`${PROXY}${path}`);

async function liveGame(appid: number): Promise<GameDetail> {
  const [storeRaw, players, spyRaw, followers] = await Promise.all([
    proxy<any>(`/app?id=${appid}`),
    proxy<{ count: number | null }>(`/players?id=${appid}`).catch(() => ({ count: null })),
    proxy<any>(`/spy?id=${appid}`).catch(() => null),
    proxy<{ count: number | null }>(`/followers?id=${appid}`).catch(() => ({ count: null })),
  ]);
  const store = mapStoreDetails(storeRaw, appid);
  if (store.missing) throw new Error('not found');
  const spy = spyRaw ? mapSpy(spyRaw) : { missing: true };

  let copies = null;
  try {
    const found = mapRobloxSearch(await proxy(`/roblox?q=${encodeURIComponent(robloxQuery(store.name))}`))
      .filter((r) => looksLikeCopy(store.name, r.name))
      .sort((a, b) => b.players - a.players || b.upVotes - a.upVotes)
      .slice(0, 6);
    const icons = found.length ? mapRobloxIcons(await proxy(`/icons?ids=${found.map((r) => r.universeId).join(',')}`).catch(() => null)) : {};
    copies = found.map((r) => ({ ...r, icon: icons[r.universeId] || null }));
  } catch {
    copies = null;
  }

  const now = Date.now();
  const g = {
    appid,
    store,
    spy: spy.missing ? null : spy,
    followers: followers.count != null ? { count: followers.count } : null,
    roblox: copies ? { copies } : null,
    ccu: players.count,
    peak: null,
    hist: [],
  };
  const m = gameMetrics(g, now);
  return {
    appid,
    name: store.name,
    header: store.header,
    capsule: store.capsule,
    screenshots: store.screenshots,
    short: store.short,
    about: store.about,
    tags: (spy.missing || !spy.tags.length ? store.genres : spy.tags).slice(0, 15),
    categories: store.categories,
    genres: store.genres,
    devs: store.devs,
    pubs: store.pubs,
    price: store.price,
    releaseText: store.releaseText,
    ...m,
    robloxCopies: copies,
    hist: [],
    updatedAt: now,
    live: true,
  } as GameDetail;
}

// Search: tracked games first (instant), then Steam through the proxy.
export async function searchLocal(q: string): Promise<SearchHit[]> {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  const index = await loadIndex();
  const scored: [number, SearchHit][] = [];
  for (const [appid, name] of index) {
    const n = name.toLowerCase();
    const i = n.indexOf(needle);
    if (i < 0) continue;
    scored.push([i === 0 ? 0 : n.includes(' ' + needle) ? 1 : 2, { appid, name, tracked: true }]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].name.length - b[1].name.length).slice(0, 6).map(([, h]) => h);
}

export async function searchSteam(q: string, signal: AbortSignal): Promise<SearchHit[]> {
  if (!PROXY || q.trim().length < 2) return [];
  const res = await fetch(`${PROXY}/search?q=${encodeURIComponent(q.trim())}`, { signal });
  if (!res.ok) return [];
  const j = await res.json();
  return (j.items || [])
    .filter((it: any) => it.type === 'app' || it.type === undefined)
    .slice(0, 8)
    .map((it: any) => ({ appid: it.id, name: it.name, img: it.tiny_image, tracked: false }));
}
