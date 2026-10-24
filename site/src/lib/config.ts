// Cloudflare Worker that proxies Steam and Roblox for live search and untracked games.
// The URL is not a secret: the worker only answers requests coming from the site's own origin.
// A PROXY_URL repo variable (passed as VITE_PROXY_URL at build time) overrides it.
const DEFAULT_PROXY = 'https://steam-radar.alcatrezz83.workers.dev';

export const PROXY: string = (import.meta.env.VITE_PROXY_URL || DEFAULT_PROXY).replace(/\/$/, '');

export const DATA = 'data';
