// Steam Radar data collector. Runs in GitHub Actions every 3 hours.
//
//   STATE_FILE  where the persistent state lives (kept on the `data` branch)
//   OUT_DIR     where JSON for the site is written
//
// Order of work: seeds -> player counts -> store details + SteamSpy (in parallel)
// -> followers -> Roblox copies -> output.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import * as src from './sources.mjs';
import { pool, sleep } from './net.mjs';
import { writeOutputs } from './output.mjs';
import { gameMetrics } from '../shared/metrics.js';
import { scoreRoblox, looksLikeCopy } from '../shared/scoring.js';
import { robloxQuery } from '../shared/mappers.js';

const STATE_FILE = process.env.STATE_FILE || '../data/state.json';
const OUT_DIR = process.env.OUT_DIR || '../data/site';
const MAX_GAMES = 1000;
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const now = Date.now();
const hourIndex = Math.floor(now / HOUR);

// Per-run request budgets. The first run fills most of the database, later runs only refresh.
const BUDGET = {
  store: Number(process.env.STORE_BUDGET || 900), // ~1.5 s each
  spy: Number(process.env.SPY_BUDGET || 900), //     ~1.1 s each
  followers: 400,
  roblox: 120,
};

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function loadState() {
  try {
    return JSON.parse(await readFile(STATE_FILE, 'utf8'));
  } catch {
    log('No state yet, starting fresh');
    return { games: {}, tagSeedAt: 0 };
  }
}

const ensure = (state, appid) => (state.games[appid] ||= { appid, firstSeen: now, hist: [] });

function seed(state, appid, source) {
  const g = ensure(state, appid);
  g.lastSeeded = now;
  g.sources = [...new Set([...(g.sources || []), source])];
  return g;
}

async function step(name, fn) {
  const t = Date.now();
  log('>>', name);
  try {
    await fn();
  } catch (e) {
    console.warn(`!! ${name} failed:`, e.message);
  }
  log(`<< ${name} (${Math.round((Date.now() - t) / 1000)}s)`);
}

const state = await loadState();

// ---------- 1. Seeds ----------

await step('seed: Steam most played', async () => {
  for (const r of await src.steamMostPlayed()) seed(state, r.appid, 'charts');
});

await step('seed: SteamSpy tops', async () => {
  for (const req of ['top100in2weeks', 'top100forever']) {
    for (const r of await src.spyTop(req)) seed(state, r.appid, 'spy');
    await sleep(2000);
  }
});

await step('seed: Steam store lists', async () => {
  // Wishlist rank is reset each run so finished games drop out of it.
  for (const g of Object.values(state.games)) delete g.wishlistRank;
  const wish = await src.steamSearchList('popularwishlist', 300);
  wish.forEach((id, i) => { seed(state, id, 'wishlist').wishlistRank = i + 1; });
  for (const [filter, n] of [['popularcomingsoon', 100], ['popularnew', 200], ['topsellers', 100]]) {
    for (const id of await src.steamSearchList(filter, n)) seed(state, id, filter);
  }
});

// Roblox-friendly genres, so the Roblox page is not limited to the global top. Once a day, SteamSpy is slow here.
if (now - (state.tagSeedAt || 0) > DAY) {
  await step('seed: SteamSpy Roblox-friendly tags', async () => {
    for (const tag of ['Online Co-Op', 'Party Game', 'Physics']) {
      const games = (await src.spyTag(tag)).sort((a, b) => (b.ccu || 0) - (a.ccu || 0)).slice(0, 80);
      for (const g of games) seed(state, g.appid, 'tag');
      await sleep(61000);
    }
    state.tagSeedAt = now;
  });
}

// ---------- 2. Drop stale games ----------

{
  const games = Object.values(state.games);
  for (const g of games) {
    if (g.store?.missing || (g.store && g.store.type && g.store.type !== 'game')) delete state.games[g.appid];
    else if (now - (g.lastSeeded || 0) > 7 * DAY) delete state.games[g.appid];
  }
  const left = Object.values(state.games);
  if (left.length > MAX_GAMES) {
    const relevance = (g) => Math.max(g.ccu || 0, (g.followers?.count || 0) / 20, g.wishlistRank ? 10000 / g.wishlistRank : 0);
    left.sort((a, b) => relevance(b) - relevance(a)).slice(MAX_GAMES).forEach((g) => delete state.games[g.appid]);
  }
  log('Tracking', Object.keys(state.games).length, 'games');
}

const games = () => Object.values(state.games);

// ---------- 3. Player counts (every run, every released game) ----------

await step('players', async () => {
  const targets = games().filter((g) => g.store?.comingSoon !== true);
  let ok = 0;
  await pool(targets, 8, 100, async (g) => {
    const n = await src.steamPlayers(g.appid);
    if (n == null) return;
    g.ccu = n;
    g.ccuAt = now;
    g.peak = Math.max(g.peak || 0, n);
    g.hist = [...(g.hist || []).filter(([h]) => h > hourIndex - 14 * 24 && h !== hourIndex), [hourIndex, n]];
    ok++;
  });
  log('  players updated:', ok, '/', targets.length);
});

// ---------- 4. Store details + SteamSpy, in parallel (different hosts) ----------

const storeStale = (g) => !g.store || now - g.store.fetchedAt > (g.store.comingSoon ? 1 : 7) * DAY;
const spyStale = (g) => !g.spy || now - g.spy.fetchedAt > 7 * DAY;
// Most relevant games first, so a partial run still covers what matters.
const byRelevance = (a, b) => (b.ccu || 0) - (a.ccu || 0) || (a.wishlistRank || 1e9) - (b.wishlistRank || 1e9);

await Promise.all([
  step('store details', async () => {
    const todo = games().filter(storeStale).sort(byRelevance).slice(0, BUDGET.store);
    log('  store queue:', todo.length);
    await pool(todo, 1, 1500, async (g) => {
      g.store = { ...(await src.steamStoreDetails(g.appid)), fetchedAt: now };
    });
  }),
  step('steamspy details', async () => {
    const todo = games().filter(spyStale).sort(byRelevance).slice(0, BUDGET.spy);
    log('  spy queue:', todo.length);
    await pool(todo, 1, 1100, async (g) => {
      const d = await src.spyDetails(g.appid);
      if (!d.missing) g.spy = { ...d, fetchedAt: now };
    });
  }),
]);

// ---------- 5. Followers for upcoming games ----------

await step('followers', async () => {
  const todo = games()
    .filter((g) => g.store && !g.store.missing && (g.store.comingSoon || g.wishlistRank))
    .filter((g) => !g.followers || now - g.followers.fetchedAt > DAY)
    .sort(byRelevance)
    .slice(0, BUDGET.followers);
  log('  followers queue:', todo.length);
  await pool(todo, 2, 1000, async (g) => {
    const count = await src.steamFollowers(g.appid);
    if (count != null) g.followers = { count, fetchedAt: now };
  });
});

// ---------- 6. Roblox copies for the best candidates ----------

await step('roblox copies', async () => {
  const candidates = games()
    .filter((g) => g.store && !g.store.missing && g.store.type === 'game')
    .map((g) => ({
      g,
      // Rank without the niche factor, so unchecked games are not penalised or boosted.
      base: scoreRoblox({ tags: g.spy?.tags || [], categories: g.store.categories, genres: g.store.genres, requiredAge: g.store.requiredAge }).total,
      m: gameMetrics(g, now),
    }))
    .filter(({ m }) => (m.ccu || 0) >= 100 || (m.reviews || 0) >= 500 || (m.followers || 0) >= 10000)
    .sort((a, b) => b.base - a.base)
    .slice(0, 250)
    .filter(({ g }) => !g.roblox || now - g.roblox.fetchedAt > 7 * DAY)
    .slice(0, BUDGET.roblox);
  log('  roblox queue:', candidates.length);
  await pool(candidates, 1, 1500, async ({ g }) => {
    const query = robloxQuery(g.store.name);
    const results = (await src.robloxSearch(query)).filter((r) => looksLikeCopy(g.store.name, r.name));
    const top = results.sort((a, b) => b.players - a.players || b.upVotes - a.upVotes).slice(0, 6);
    const icons = await src.robloxIcons(top.map((r) => r.universeId)).catch(() => ({}));
    g.roblox = { copies: top.map((r) => ({ ...r, icon: icons[r.universeId] || null })), fetchedAt: now };
  });
});

// ---------- 7. Save ----------

await mkdir(path.dirname(STATE_FILE), { recursive: true });
await mkdir(OUT_DIR, { recursive: true });
state.updatedAt = now;
await writeFile(STATE_FILE, JSON.stringify(state));
const counts = await writeOutputs(state, OUT_DIR, now);
log('Done. Lists:', JSON.stringify(counts));
