import type { Range } from './types';

export function num(n: number | null | undefined): string {
  if (n == null) return 'n/a';
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(n);
}

export const full = (n: number | null | undefined) => (n == null ? 'n/a' : n.toLocaleString('en-US'));

// 10M..20M -> "10-20M", 500K..1M -> "500K-1M"
export function range(r: Range | null | undefined): string {
  if (!r) return 'n/a';
  if (r.low === 0) return `<${num(r.high)}`;
  const a = num(r.low), b = num(r.high);
  const sa = a.replace(/[\d.]/g, ''), sb = b.replace(/[\d.]/g, '');
  return sa === sb ? `${a.slice(0, a.length - sa.length)}-${b}` : `${a}-${b}`;
}

export const signedPct = (p: number | null | undefined) => (p == null ? null : `${p > 0 ? '+' : ''}${p}%`);

export function ago(ts: number): string {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

export const days = (d: number) => (d === 0 ? 'today' : d === 1 ? '1 day ago' : `${d} days ago`);
