import { useEffect, useState } from 'react';
import { loadGame } from '../lib/data';
import { PROXY } from '../lib/config';
import { ago, days, full, num, range, signedPct } from '../lib/format';
import type { GameDetail } from '../lib/types';
import { Cover } from '../components/Cover';
import { PlayerChart } from '../components/PlayerChart';
import { ScoreBar, scoreTone } from '../components/ScoreBar';

const trackers = (id: number) => [
  { name: 'Steam store', url: `https://store.steampowered.com/app/${id}` },
  { name: 'SteamDB', url: `https://steamdb.info/app/${id}/charts/` },
  { name: 'SteamCharts', url: `https://steamcharts.com/app/${id}` },
  { name: 'SteamSpy', url: `https://steamspy.com/app/${id}` },
  { name: 'Gamalytic', url: `https://gamalytic.com/game/${id}` },
  { name: 'VG Insights', url: `https://vginsights.com/game/${id}` },
];

export function GamePage({ appid }: { appid: number }) {
  const [game, setGame] = useState<GameDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setGame(null);
    setError(false);
    loadGame(appid).then(setGame, () => setError(true));
  }, [appid]);

  useEffect(() => {
    document.title = game ? `${game.name}, Steam Radar` : 'Steam Radar';
  }, [game]);

  if (error) {
    return (
      <main className="page">
        <div className="empty">
          <h2>This game is not tracked</h2>
          <p>
            {PROXY ? 'Steam did not return this game. It may be region locked or removed.' : 'Steam Radar tracks about a thousand games. Live lookup for the rest needs the search proxy.'}
          </p>
          <a className="button" href={`https://store.steampowered.com/app/${appid}`} target="_blank" rel="noopener">Open on Steam</a>
        </div>
      </main>
    );
  }

  if (!game) {
    return (
      <main className="page">
        <div className="detail-skeleton" />
      </main>
    );
  }

  const r = game.roblox;
  const robloxSearch = `https://www.roblox.com/discover/?Keyword=${encodeURIComponent(game.name.replace(/[™®©]/g, ''))}`;

  return (
    <main className="page detail">
      <a className="back" href="#/" onClick={(e) => { if (history.length > 1) { e.preventDefault(); history.back(); } }}>Back to lists</a>

      <section className="detail-hero">
        <Cover appid={game.appid} src={game.header} name={game.name} className="detail-cover" />
        <div className="detail-intro">
          <h1>{game.name}</h1>
          <p className="detail-sub">
            {game.devs.join(', ') || 'Unknown developer'}
            {game.released ? `, released ${game.releaseText}` : `, ${game.releaseText || 'release date not announced'}`}
            {game.daysSinceRelease != null && game.daysSinceRelease <= 365 ? ` (${days(game.daysSinceRelease)})` : ''}
          </p>
          <p className="detail-short">{game.short}</p>
          <ul className="tags">
            {game.tags.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
      </section>

      <section className="figures" aria-label="Key numbers">
        {game.released ? (
          <>
            <Figure value={full(game.ccu)} label="Playing now" note={signedPct(game.growth24h) ? `${signedPct(game.growth24h)} in 24 h` : undefined} accent />
            <Figure value={full(game.avg7d)} label="Average players, 7 days" />
            <Figure value={full(game.peak)} label="Peak seen by Steam Radar" />
            <Figure value={range(game.owners)} label="Owners, SteamSpy estimate" />
            <Figure value={num(game.reviews)} label="Reviews" note={game.reviewScore != null ? `${game.reviewScore}% positive` : undefined} />
            <Figure value={game.price || 'n/a'} label="Price, US store" />
          </>
        ) : (
          <>
            <Figure value={full(game.followers)} label="Followers" accent />
            <Figure value={game.wishlistEst ? `~${range(game.wishlistEst)}` : 'n/a'} label="Wishlists, estimated" />
            <Figure value={game.releaseText || 'n/a'} label="Release" />
            <Figure value={game.price || 'Not set'} label="Price, US store" />
          </>
        )}
      </section>

      <div className="detail-cols">
        <div className="detail-main">
          {game.released && (
            <section className="block">
              <h2>Players, last 14 days</h2>
              {game.live
                ? <p className="chart-empty">History is only collected for tracked games. SteamDB and SteamCharts below have the full graph.</p>
                : <PlayerChart hist={game.hist} />}
            </section>
          )}

          <section className="block">
            <h2>Gameplay</h2>
            <div className="about">
              {(game.about || game.short).split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
            </div>
            {game.screenshots.length > 0 && (
              <div className="shots">
                {game.screenshots.map((s) => <img key={s} src={s} alt="" loading="lazy" />)}
              </div>
            )}
          </section>

          <section className="block">
            <h2>Already on Roblox</h2>
            {game.robloxCopies == null ? (
              <p className="muted">Roblox has not been searched for this game yet. Only the best Roblox candidates are checked, once a week.</p>
            ) : game.robloxCopies.length === 0 ? (
              <p className="muted">No Roblox game with a matching name was found. Copies under a different name can still exist.</p>
            ) : (
              <ul className="copies">
                {game.robloxCopies.map((c) => (
                  <li key={c.universeId}>
                    <a href={c.url} target="_blank" rel="noopener">
                      {c.icon ? <img src={c.icon} alt="" loading="lazy" /> : <span className="copy-noicon" />}
                      <span className="copy-name">{c.name}</span>
                      <span className="copy-stats">
                        {num(c.players)} playing, {c.upVotes + c.downVotes > 0 ? Math.round((c.upVotes / (c.upVotes + c.downVotes)) * 100) + '% likes' : 'no votes'}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <a className="link" href={robloxSearch} target="_blank" rel="noopener">Search Roblox for this game</a>
          </section>
        </div>

        <aside className="detail-side">
          <section className="block roblox-card">
            <h2>Roblox fit</h2>
            <p className="big-score">
              <span className={`score-num score-${scoreTone(r.total)}`}>{r.total}</span>
              <span className="score-of">/100</span>
            </p>
            <ScoreBar parts={r.parts.map((p) => [p.score, p.max])} labels={r.parts.map((p) => p.label)} size="lg" />
            {r.flags.map((f) => <p key={f} className="flag">{f}</p>)}
            <dl className="factors">
              {r.parts.map((p) => (
                <div key={p.key} className="factor">
                  <dt>
                    <span>{p.label}</span>
                    <span className="factor-score">{p.score}/{p.max}</span>
                  </dt>
                  <dd>{p.hits.length ? p.hits.map((h) => h.startsWith('-') ? <span key={h} className="hit hit-neg">{h.slice(1)}</span> : <span key={h} className="hit">{h}</span>) : <span className="muted">No signals in tags</span>}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="block">
            <h2>Trackers</h2>
            <ul className="trackers">
              {trackers(game.appid).map((t) => (
                <li key={t.name}><a href={t.url} target="_blank" rel="noopener">{t.name}</a></li>
              ))}
            </ul>
            <p className="muted small">{game.live ? 'Fetched live from Steam just now.' : `Data from ${ago(game.updatedAt)}.`}</p>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Figure({ value, label, note, accent }: { value: string; label: string; note?: string; accent?: boolean }) {
  return (
    <div className={`figure ${accent ? 'figure-accent' : ''}`}>
      <span className="figure-value">{value}</span>
      <span className="figure-label">{label}</span>
      {note && <span className={`figure-note ${note.startsWith('-') ? 'tone-down' : note.startsWith('+') ? 'tone-up' : ''}`}>{note}</span>}
    </div>
  );
}
