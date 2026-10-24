import { useState } from 'react';
import { full } from '../lib/format';

const HOUR = 3600 * 1000;

// Players over the last 14 days, from the collector's 3-hourly snapshots.
export function PlayerChart({ hist }: { hist: [number, number][] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (hist.length < 2) {
    return <p className="chart-empty">The player graph appears after a few collector runs.</p>;
  }
  const W = 720, H = 200, padL = 8, padR = 8, padT = 12, padB = 24;
  const xs = hist.map(([h]) => h);
  const ys = hist.map(([, v]) => v);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const yMax = Math.max(...ys) * 1.08 || 1;
  const X = (h: number) => padL + ((h - x0) / Math.max(1, x1 - x0)) * (W - padL - padR);
  const Y = (v: number) => padT + (1 - v / yMax) * (H - padT - padB);
  const line = hist.map(([h, v], i) => `${i ? 'L' : 'M'}${X(h).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${X(x1)},${H - padB} L${X(x0)},${H - padB} Z`;

  // Day ticks
  const ticks: number[] = [];
  for (let h = Math.ceil(x0 / 24) * 24; h <= x1; h += 24 * (x1 - x0 > 24 * 8 ? 2 : 1)) ticks.push(h);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    hist.forEach(([h], i) => { if (Math.abs(X(h) - px) < Math.abs(X(hist[best][0]) - px)) best = i; });
    setHover(best);
  };

  const hp = hover != null ? hist[hover] : null;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={`Players over ${Math.round((x1 - x0) / 24)} days, from ${full(ys[0])} to ${full(ys[ys.length - 1])}`}>
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--amber)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--amber)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((h) => (
          <g key={h}>
            <line x1={X(h)} x2={X(h)} y1={padT} y2={H - padB} className="chart-grid" />
            <text x={X(h)} y={H - 6} className="chart-tick" textAnchor="middle">
              {new Date(h * HOUR).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#chart-fill)" />
        <path d={line} fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinejoin="round" />
        {hp && (
          <g>
            <line x1={X(hp[0])} x2={X(hp[0])} y1={padT} y2={H - padB} className="chart-cursor" />
            <circle cx={X(hp[0])} cy={Y(hp[1])} r="4" fill="var(--amber)" />
          </g>
        )}
      </svg>
      <p className="chart-readout">
        {hp
          ? `${full(hp[1])} players, ${new Date(hp[0] * HOUR).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' })}`
          : `Low ${full(Math.min(...ys))}, high ${full(Math.max(...ys))} over the period`}
      </p>
    </div>
  );
}
