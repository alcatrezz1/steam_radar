import { useEffect, useState } from 'react';
import { loadLists } from '../lib/data';
import { ago, days, num, range, signedPct } from '../lib/format';
import type { Lists } from '../lib/types';
import { GameCard, Stat } from '../components/GameCard';
import { ScoreBar, scoreTone } from '../components/ScoreBar';

type Kind = 'popular' | 'rising' | 'upcoming' | 'roblox';

const PAGES: Record<Kind, { title: string; note: string }> = {
  popular: {
    title: 'Most played right now',
    note: 'Ranked by players online at the last update. Owner counts are SteamSpy estimates, Steam does not publish sales.',
  },
  rising: {
    title: 'Rising fast',
    note: 'Released in the last 90 days, ranked by how big an audience they built for their age. Growth needs a day of history to show up.',
  },
  upcoming: {
    title: 'Most anticipated',
    note: 'Not released yet, ranked by Steam followers. Steam keeps wishlist counts private, so wishlists are estimated at 7 to 12 times followers.',
  },
  roblox: {
    title: 'Best fit for a Roblox remake',
    note: 'Scored out of 100 from Steam tags: simple graphics, few mechanics, multiplayer, short sessions, Roblox audience, viral potential and a free niche on Roblox.',
  },
};

const FACTORS = ['Simple graphics', 'Few mechanics', 'Multiplayer', 'Short sessions', 'Roblox audience fit', 'Viral potential', 'Free niche'];

const growthTone = (p: number | null) => (p == null ? undefined : p >= 0 ? 'up' : 'down');

export function ListPage({ kind }: { kind: Kind }) {
  const [lists, setLists] = useState<Lists | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadLists().then(setLists, () => setError(true));
  }, []);

  const page = PAGES[kind];

  return (
    <main className="page">
      <header className="page-head">
        <h1>{page.title}</h1>
        <p className="page-note">{page.note}</p>
        {lists && (
          <p className="page-meta">
            Updated {ago(lists.meta.updatedAt)}, {lists.meta.tracked} games tracked
          </p>
        )}
      </header>

      {error && (
        <div className="empty">
          <h2>No data yet</h2>
          <p>The collector has not finished its first run. It runs every 3 hours in GitHub Actions, the first run takes about 30 minutes.</p>
        </div>
      )}
      {!lists && !error && <div className="grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="card card-skeleton" />)}</div>}

      {lists && lists[kind].length === 0 && (
        <div className="empty">
          <h2>Nothing here yet</h2>
          <p>{kind === 'rising' ? 'No game released in the last 90 days has enough players yet. Check back after the next update.' : 'This list fills after the next collector run.'}</p>
        </div>
      )}

      {lists && (
        <div className="grid">
          {kind === 'popular' &&
            lists.popular.map((g, i) => (
              <GameCard key={g.appid} game={g} rank={i + 1} badge={signedPct(g.growth24h) && <span className={`card-badge tone-${growthTone(g.growth24h)}`}>{signedPct(g.growth24h)} in 24 h</span>}>
                <Stat value={num(g.ccu)} label="Playing now" tone="amber" />
                <Stat value={range(g.owners)} label="Owners, est." />
                <Stat value={num(g.peak)} label="Peak seen" />
              </GameCard>
            ))}

          {kind === 'rising' &&
            lists.rising.map((g, i) => (
              <GameCard key={g.appid} game={g} rank={i + 1} badge={<span className="card-badge">Out {days(g.days)}</span>}>
                <Stat value={num(g.ccu)} label="Playing now" tone="amber" />
                <Stat value={num(g.peak)} label="Peak seen" />
                {g.growth7d != null
                  ? <Stat value={signedPct(g.growth7d)} label="Players, 7 days" tone={growthTone(g.growth7d)} />
                  : <Stat value={g.reviewsPerDay != null ? `${num(g.reviewsPerDay)}/day` : 'n/a'} label="New reviews" />}
              </GameCard>
            ))}

          {kind === 'upcoming' &&
            lists.upcoming.map((g, i) => (
              <GameCard key={g.appid} game={g} rank={i + 1} badge={<span className="card-badge">{g.releaseText || 'Coming soon'}</span>}>
                <Stat value={num(g.followers)} label="Followers" tone="amber" />
                <Stat value={g.wishlistEst ? `~${range(g.wishlistEst)}` : 'n/a'} label="Wishlists, est." />
                <Stat value={g.wishlistRank ? `#${g.wishlistRank}` : 'n/a'} label="Steam wishlist rank" />
              </GameCard>
            ))}

          {kind === 'roblox' &&
            lists.roblox.map((g, i) => (
              <GameCard key={g.appid} game={g} rank={i + 1} badge={!g.released && <span className="card-badge">Not released</span>}>
                <div className="card-score">
                  <p className="card-score-num">
                    <span className={`score-num score-${scoreTone(g.score)}`}>{g.score}</span>
                    <span className="score-of">/100</span>
                  </p>
                  <Stat value={g.copies == null ? 'Not checked' : g.copies === 0 ? 'None' : g.copies} label="Roblox copies" />
                  <ScoreBar parts={g.parts} labels={FACTORS} />
                  <p className="card-strengths">Strong in {g.strengths.join(' and ')}</p>
                </div>
              </GameCard>
            ))}
        </div>
      )}
    </main>
  );
}
