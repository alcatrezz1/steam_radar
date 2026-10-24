# Steam Radar

A Steam game tracker built for finding Roblox remake ideas.

- **Popular**: most played games right now, with owner estimates and peak players.
- **Rising**: games released in the last 90 days that built a big audience fast.
- **Upcoming**: unreleased games with the biggest following, with a wishlist estimate.
- **Roblox fit**: every tracked game scored 0 to 100 for how well it would work as a Roblox game.

Each game has a detail page with its description, tags, player graph, price, existing Roblox copies, the full score breakdown and links to SteamDB, SteamCharts, SteamSpy, Gamalytic and VG Insights. The search box finds tracked games instantly and, with the proxy set up, any game on Steam.

## How it works

```
GitHub Actions (every 3 h)
  collector/collect.mjs  ->  Steam API, Steam store, SteamSpy, Roblox search
        |                    state saved to the `data` branch (one commit, force-pushed)
        v
  site/public/data/*.json  ->  Vite build  ->  GitHub Pages

Browser search and untracked games  ->  Cloudflare Worker (worker/worker.js)  ->  Steam, Roblox
```

Steam and Roblox block requests from other websites, so the site never calls them directly. Tracked data is collected by Actions, live lookups go through the worker.

| Folder | What |
|---|---|
| `shared/` | Roblox scoring, metrics and response parsing, used by both the collector and the site |
| `collector/` | Data collector (`collect.mjs`), offline rebuild (`render.mjs`), fake data for local work (`mock.mjs`) |
| `site/` | React + Vite site |
| `worker/` | Cloudflare Worker proxy |

## Numbers to know about

- **Owners** are SteamSpy estimates. Steam does not publish sales.
- **Wishlists** are private on Steam. The site shows followers (exact) and estimates wishlists at 7 to 12 times followers.
- **Average players** and **growth** come from the collector's own 3-hourly snapshots, so they need a day or a week of history before they appear.
- **Roblox fit** is a heuristic on Steam user tags. It is a shortlist tool, not a verdict.

## Roblox fit score

| Factor | Points | Signals |
|---|---|---|
| Simple graphics | 20 | Low-poly, Pixel Graphics, Stylized, Cartoony vs Realistic, Cinematic |
| Few mechanics | 20 | Arcade, Party Game, Casual vs RPG, Open World, Grand Strategy, 4X |
| Multiplayer | 20 | Online co-op or PvP from Steam categories and tags |
| Short sessions | 10 | Party Game, Roguelite, Arcade vs Story Rich, long RPGs |
| Roblox audience fit | 10 | Funny, Cute, Horror, Physics vs Gore, adult content, 17+ rating |
| Viral potential | 10 | Funny, Physics, Memes, Social Deduction, Proximity Voice Chat |
| Free niche | 10 | Fewer active Roblox copies is better |

Tags near the top of a game's tag list count more. Weights live in `shared/scoring.js`.

## Setup

1. **Pages**: Settings, Pages, Source: **GitHub Actions**.
2. **First run**: Actions, *Collect and deploy*, Run workflow. The first collection takes about 30 to 40 minutes, later runs take a few minutes.
3. **Search proxy** (optional but recommended):
   1. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up).
   2. Workers & Pages, Create, Create Worker, give it a name, Deploy, then Edit code.
   3. Replace the code with `worker/worker.js`, Deploy.
   4. Copy the worker URL (like `https://steam-radar.<you>.workers.dev`).
   5. Put that URL in `DEFAULT_PROXY` in `site/src/lib/config.ts`, or set a `PROXY_URL` repo variable (Settings, Secrets and variables, Actions, Variables).
   6. Re-run the workflow (untick *Collect* to only rebuild).

## Local development

```bash
cd collector && node mock.mjs   # fake data into site/public/data
cd ../site && npm install && npm run dev
```

For local live search, run the worker with `npx wrangler dev worker/worker.js` and start the site with `VITE_PROXY_URL=http://localhost:8787 npm run dev`.
