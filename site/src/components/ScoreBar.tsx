// The Roblox score as one bar split into seven factor segments.
// Each segment's width is the factor's weight, its fill is how much of it the game earns.
export function ScoreBar({ parts, labels, size = 'sm' }: { parts: [number, number][]; labels?: string[]; size?: 'sm' | 'lg' }) {
  return (
    <div className={`scorebar scorebar-${size}`} role="img" aria-label={parts.map(([s, m], i) => `${labels?.[i] ?? 'Factor'} ${s} of ${m}`).join(', ')}>
      {parts.map(([score, max], i) => (
        <span key={i} className="seg" style={{ flexGrow: max }} title={labels ? `${labels[i]}: ${score}/${max}` : undefined}>
          <span className="seg-fill" style={{ width: `${(score / max) * 100}%` }} />
        </span>
      ))}
    </div>
  );
}

export const scoreTone = (s: number) => (s >= 75 ? 'hot' : s >= 55 ? 'warm' : 'cool');
