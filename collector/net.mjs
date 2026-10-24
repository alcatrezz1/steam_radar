// Small network helpers: polite fetch with retries, sleep, limited concurrency.

// SLEEP_SCALE=0 skips waits, for tests against mocked APIs only.
const SCALE = Number(process.env.SLEEP_SCALE ?? 1);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms * SCALE));

const UA = 'SteamRadar/1.0 (+https://github.com/alcatrezz1/steam_radar)';

export class RateLimited extends Error {}

// Fetch with retries. Returns parsed JSON (or text when as='text').
// Throws RateLimited when the host keeps answering 429, so callers can stop that source for this run.
export async function get(url, { as = 'json', retries = 2, backoff = 30000, headers = {} } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers } });
      if (res.status === 429 || res.status === 403) {
        lastErr = new RateLimited(`${res.status} ${url}`);
        if (attempt < retries) await sleep(backoff * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return as === 'text' ? await res.text() : await res.json();
    } catch (e) {
      if (e instanceof RateLimited) throw e;
      lastErr = e;
      if (attempt < retries) await sleep(2000 * (attempt + 1));
    }
  }
  throw lastErr;
}

// Run fn over items, `concurrency` at a time, waiting `gap` ms between starts per worker.
export async function pool(items, concurrency, gap, fn) {
  let i = 0;
  let stopped = false;
  const stop = () => { stopped = true; };
  const worker = async () => {
    while (!stopped && i < items.length) {
      const item = items[i++];
      try {
        await fn(item, stop);
      } catch (e) {
        if (e instanceof RateLimited) {
          console.warn('  rate limited, stopping this source for the run:', e.message);
          stopped = true;
        } else {
          console.warn('  skip:', e.message);
        }
      }
      if (gap) await sleep(gap);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}
