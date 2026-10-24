// Per-game metrics from collector state. Pure, shared by the collector and the site (live mode).
import { scoreRoblox } from './scoring.js';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

export function parseRelease(text) {
  if (!text) return null;
  const t = Date.parse(text.replace(/(\d+)(st|nd|rd|th)/, '$1'));
  return Number.isFinite(t) ? t : null;
}

// History points are [hourIndex, players]; hourIndex = hours since epoch.
export const histSince = (hist, sinceMs) => (hist || []).filter(([h]) => h * HOUR >= sinceMs);

function playersAgo(hist, now, agoMs, toleranceMs) {
  const target = now - agoMs;
  let best = null;
  for (const [h, v] of hist || []) {
    const d = Math.abs(h * HOUR - target);
    if (d <= toleranceMs && (!best || d < best.d)) best = { d, v };
  }
  return best ? best.v : null;
}

const pct = (now, before) => (before && before > 0 && now != null ? Math.round(((now - before) / before) * 100) : null);

export function gameMetrics(g, now) {
  const s = g.store || {};
  const spy = g.spy || {};
  const released = s.comingSoon === false;
  const releaseAt = parseRelease(s.releaseText);
  const daysSinceRelease = released && releaseAt ? Math.max(0, Math.floor((now - releaseAt) / DAY)) : null;
  const week = histSince(g.hist, now - 7 * DAY).map(([, v]) => v);
  const avg7d = week.length >= 4 ? Math.round(week.reduce((a, b) => a + b, 0) / week.length) : null;
  const reviews = spy.positive != null ? spy.positive + (spy.negative || 0) : s.recommendations ?? null;
  const reviewScore = spy.positive != null && reviews ? Math.round((spy.positive / reviews) * 100) : null;
  const followers = g.followers?.count ?? null;
  const roblox = scoreRoblox({
    tags: spy.tags || [],
    categories: s.categories || [],
    genres: s.genres || [],
    requiredAge: s.requiredAge || 0,
    robloxCopies: g.roblox?.copies ?? null,
  });
  return {
    released,
    releaseAt,
    daysSinceRelease,
    ccu: released ? g.ccu ?? null : null,
    peak: released ? g.peak ?? null : null,
    avg7d,
    growth24h: pct(g.ccu, playersAgo(g.hist, now, DAY, 4 * HOUR)),
    growth7d: pct(g.ccu, playersAgo(g.hist, now, 7 * DAY, 12 * HOUR)),
    owners: spy.owners || null,
    reviews,
    reviewScore,
    reviewsPerDay: reviews != null && daysSinceRelease != null ? Math.round(reviews / Math.max(1, daysSinceRelease)) : null,
    followers,
    // Industry rule of thumb: wishlists are roughly 7 to 12 times followers. Always shown as an estimate.
    wishlistEst: followers ? { low: followers * 7, high: followers * 12 } : null,
    roblox,
  };
}
