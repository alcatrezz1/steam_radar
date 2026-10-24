// Cloudflare Worker URL, set at build time from the PROXY_URL repo variable.
// Empty means no proxy: search covers only tracked games, and untracked games open on Steam.
export const PROXY: string = (import.meta.env.VITE_PROXY_URL || '').replace(/\/$/, '');

export const DATA = 'data';
