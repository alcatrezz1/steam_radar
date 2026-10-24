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
// On a rate limit the pool cools down for `cooldown` ms and carries on; after `strikes` limits it gives up for this run.
// Returns how many items finished without an error.
export async function pool(items, concurrency, gap, fn, { strikes = 1, cooldown = 0 } = {}) {
  const total = items.length;
  let i = 0;
  let done = 0;
  let left = strikes;
  let stopped = false;
  const worker = async () => {
    while (!stopped && i < items.length) {
      const item = items[i++];
      try {
        await fn(item);
        done++;
      } catch (e) {
        if (e instanceof RateLimited) {
          left--;
          if (left <= 0) {
            console.warn(`  rate limited, stopping this source for the run (${done}/${total} done):`, e.message);
            stopped = true;
          } else {
            console.warn(`  rate limited, cooling down ${Math.round(cooldown / 1000)} s (${left} tries left)`);
            items.splice(i, 0, item); // put the item back so it is retried after the pause
            await sleep(cooldown);
          }
        } else {
          console.warn('  skip:', e.message);
        }
      }
      if (gap) await sleep(gap);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return done;
}
