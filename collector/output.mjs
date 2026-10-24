// Turns collector state into the JSON files the site reads.
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { gameMetrics, histSince } from '../shared/metrics.js';

const DAY = 24 * 3600 * 1000;

const card = (g, m) => ({
  appid: g.appid,
  name: g.store.name,
  img: g.store.header,
  tags: (g.spy?.tags?.length ? g.spy.tags : g.store.genres || []).slice(0, 3),
});

// Steam lists some apps as games that are really tools (Wallpaper Engine). Their genres give them away.
const SOFTWARE_GENRES = new Set([
  'Utilities', 'Software Training', 'Design & Illustration', 'Animation & Modeling', 'Video Production',
  'Audio Production', 'Web Publishing', 'Photo Editing', 'Game Development', 'Education', 'Accounting',
]);
const isRealGame = (g) =>
  g.store && !g.store.missing && g.store.type === 'game' && !(g.store.genres || []).some((x) => SOFTWARE_GENRES.has(x));

export async function writeOutputs(state, outDir, now = Date.now()) {
  const all = Object.values(state.games).filter(isRealGame);
  const withM = all.map((g) => ({ g, m: gameMetrics(g, now) }));

  // 1. Popular right now
  const popular = withM
    .filter(({ m }) => m.released && m.ccu > 0)
    .sort((a, b) => b.m.ccu - a.m.ccu)
    .slice(0, 100)
    .map(({ g, m }) => ({ ...card(g, m), ccu: m.ccu, peak: m.peak, owners: m.owners, reviews: m.reviews, growth24h: m.growth24h }));

  // 2. Rising: released in the last 90 days, ranked by audience gained per time since release
  const rising = withM
    .filter(({ m }) => m.released && m.daysSinceRelease != null && m.daysSinceRelease <= 90)
    .filter(({ m }) => (m.ccu || 0) >= 50 || (m.reviews || 0) >= 100)
    .map(({ g, m }) => {
      const audience = Math.max(m.ccu || 0, m.peak || 0) + (m.reviewsPerDay || 0) * 10;
      return { g, m, rank: audience / Math.sqrt(m.daysSinceRelease + 2) };
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 100)
    .map(({ g, m }) => ({
      ...card(g, m),
      ccu: m.ccu, peak: m.peak, days: m.daysSinceRelease, reviews: m.reviews,
      reviewsPerDay: m.reviewsPerDay, growth24h: m.growth24h, growth7d: m.growth7d, owners: m.owners,
    }));

  // 3. Upcoming with the biggest following
  const upcoming = withM
    .filter(({ m }) => !m.released)
    .sort((a, b) => (b.m.followers || 0) - (a.m.followers || 0) || (a.g.wishlistRank || 1e9) - (b.g.wishlistRank || 1e9))
    .slice(0, 100)
    .map(({ g, m }) => ({
      ...card(g, m), followers: m.followers, wishlistEst: m.wishlistEst,
      releaseText: g.store.releaseText, wishlistRank: g.wishlistRank || null,
    }));

  // 4. Best fit for a Roblox remake. Needs some proof that people care about the game.
  const roblox = withM
    .filter(({ m }) => (m.ccu || 0) >= 100 || (m.reviews || 0) >= 500 || (m.followers || 0) >= 10000)
    .sort((a, b) => b.m.roblox.total - a.m.roblox.total || (b.m.ccu || 0) - (a.m.ccu || 0))
    .slice(0, 100)
    .map(({ g, m }) => ({
      ...card(g, m),
      score: m.roblox.total,
      // [score, max] per factor, drawn as the segmented bar on cards
      parts: m.roblox.parts.map((p) => [p.score, p.max]),
      strengths: [...m.roblox.parts].sort((a, b) => b.score / b.max - a.score / a.max).slice(0, 2).map((p) => p.label),
      copies: g.roblox ? g.roblox.copies.length : null,
      ccu: m.ccu, released: m.released,
    }));

  await rm(path.join(outDir, 'games'), { recursive: true, force: true });
  await mkdir(path.join(outDir, 'games'), { recursive: true });

  const meta = { updatedAt: now, tracked: all.length };
  await writeFile(path.join(outDir, 'lists.json'), JSON.stringify({ meta, popular, rising, upcoming, roblox }));
  await writeFile(path.join(outDir, 'index.json'), JSON.stringify(all.map((g) => [g.appid, g.store.name])));

  for (const { g, m } of withM) {
    const s = g.store;
    const detail = {
      appid: g.appid,
      name: s.name,
      header: s.header,
      capsule: s.capsule,
      screenshots: s.screenshots || [],
      short: s.short,
      about: s.about,
      tags: (g.spy?.tags?.length ? g.spy.tags : s.genres || []).slice(0, 15),
      categories: s.categories,
      genres: s.genres,
      devs: s.devs,
      pubs: s.pubs,
      price: s.price,
      releaseText: s.releaseText,
      ...m,
      robloxCopies: g.roblox?.copies ?? null,
      robloxCheckedAt: g.roblox?.fetchedAt ?? null,
      hist: histSince(g.hist, now - 14 * DAY),
      updatedAt: now,
    };
    await writeFile(path.join(outDir, 'games', `${g.appid}.json`), JSON.stringify(detail));
  }

  return { popular: popular.length, rising: rising.length, upcoming: upcoming.length, roblox: roblox.length };
}
