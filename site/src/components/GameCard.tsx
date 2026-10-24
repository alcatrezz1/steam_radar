import type { ReactNode } from 'react';
import { Cover } from './Cover';
import type { CardBase } from '../lib/types';

export function Stat({ value, label, tone }: { value: ReactNode; label: string; tone?: 'up' | 'down' | 'amber' }) {
  return (
    <div className="stat">
      <span className={`stat-value ${tone ? 'tone-' + tone : ''}`}>{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export function GameCard({ game, rank, children, badge }: { game: CardBase; rank: number; children: ReactNode; badge?: ReactNode }) {
  return (
    <a className="card" href={`#/game/${game.appid}`}>
      <div className="card-media">
        <Cover appid={game.appid} src={game.img} name={game.name} />
        <span className="card-rank" aria-label={`Rank ${rank}`}>{rank}</span>
        {badge}
      </div>
      <div className="card-body">
        <h3 className="card-title">{game.name}</h3>
        {game.tags.length > 0 && <p className="card-tags">{game.tags.join(', ')}</p>}
        <div className="card-stats">{children}</div>
      </div>
    </a>
  );
}
