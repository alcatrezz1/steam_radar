// Fake data for local development of the site, no network needed.
//   node mock.mjs  ->  writes ../site/public/data
// Numbers are made up. Real data comes from collect.mjs in GitHub Actions.
import { writeOutputs } from './output.mjs';

const OUT_DIR = process.env.OUT_DIR || '../site/public/data';
const now = Date.now();
const H = 3600 * 1000;
const D = 24 * H;
const hourIndex = Math.floor(now / H);
const img = (id) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`;
const fmtDate = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// [appid, name, tags, categories, ccu, owners, reviews, daysAgo|null(upcoming), followers, price]
const G = [
  [730, 'Counter-Strike 2', ['FPS', 'Shooter', 'Multiplayer', 'Competitive', 'Action', 'Team-Based', 'Tactical', 'PvP'], ['Multi-player', 'Online PvP'], 1450000, [50e6, 100e6], 8.9e6, 4000, null, 'Free'],
  [570, 'Dota 2', ['Free to Play', 'MOBA', 'Multiplayer', 'Strategy', 'PvP', 'Team-Based', 'RTS'], ['Multi-player', 'Online PvP'], 720000, [100e6, 200e6], 2.4e6, 4500, null, 'Free'],
  [578080, 'PUBG: BATTLEGROUNDS', ['Survival', 'Shooter', 'Battle Royale', 'Multiplayer', 'FPS', 'PvP', 'Realistic'], ['Multi-player', 'Online PvP'], 640000, [50e6, 100e6], 2.5e6, 3000, null, 'Free'],
  [1966720, 'Lethal Company', ['Online Co-Op', 'Horror', 'First-Person', 'Co-op', 'Survival Horror', 'Exploration', 'Funny', 'Psychological Horror'], ['Multi-player', 'Online Co-op'], 18000, [10e6, 20e6], 487000, 1080, null, '$9.99'],
  [3241660, 'R.E.P.O.', ['Online Co-Op', 'Horror', 'Funny', 'Physics', 'Co-op', 'Multiplayer', 'First-Person', 'Comedy'], ['Multi-player', 'Online Co-op'], 61000, [5e6, 10e6], 210000, 220, null, '$9.99'],
  [3527290, 'PEAK', ['Co-op', 'Online Co-Op', 'Climbing', 'Funny', 'Physics', 'Survival', 'Exploration', 'Stylized'], ['Multi-player', 'Online Co-op'], 88000, [5e6, 10e6], 120000, 40, null, '$7.99'],
  [1145360, 'Hades', ['Action Roguelike', 'Roguelite', 'Hack and Slash', 'Mythology', 'Great Soundtrack', 'Story Rich'], ['Single-player'], 6000, [5e6, 10e6], 270000, 1800, null, '$24.99'],
  [289070, "Sid Meier's Civilization VI", ['Strategy', 'Turn-Based Strategy', '4X', 'Historical', 'Multiplayer', 'Grand Strategy'], ['Single-player', 'Multi-player', 'Online PvP'], 34000, [10e6, 20e6], 210000, 3000, null, '$59.99'],
  [3164500, 'Schedule I', ['Simulation', 'Crime', 'Open World', 'Management', 'Online Co-Op', 'Funny', 'Sandbox'], ['Single-player', 'Multi-player', 'Online Co-op'], 52000, [5e6, 10e6], 150000, 75, null, '$19.99'],
  [2767030, 'Marvel Rivals', ['Hero Shooter', 'Shooter', 'Multiplayer', 'PvP', 'Superhero', 'Team-Based', 'Third-Person Shooter'], ['Multi-player', 'Online PvP'], 110000, [10e6, 20e6], 300000, 300, null, 'Free'],
  [1172470, 'Apex Legends', ['Free to Play', 'Battle Royale', 'Multiplayer', 'FPS', 'Shooter', 'Hero Shooter'], ['Multi-player', 'Online PvP'], 140000, [50e6, 100e6], 900000, 2100, null, 'Free'],
  [3405690, 'Escape the Backrooms 2', ['Horror', 'Online Co-Op', 'Exploration', 'Psychological Horror', 'Co-op', 'Low-poly'], ['Multi-player', 'Online Co-op'], 9000, [500e3, 1e6], 9000, 12, null, '$9.99'],
  [2878980, 'Sprout Party', ['Party Game', 'Minigames', 'Online Co-Op', 'Funny', 'Cute', 'Colorful', 'Casual'], ['Multi-player', 'Online PvP'], 3200, [200e3, 500e3], 2400, 9, null, '$4.99'],
  [3489700, 'Hollow Knight: Silksong', ['Metroidvania', 'Souls-like', 'Platformer', '2D', 'Difficult', 'Hand-drawn'], ['Single-player'], null, null, null, null, 2600000, '$19.99'],
  [2001120, 'Split Fiction', ['Co-op', 'Online Co-Op', 'Action-Adventure', 'Story Rich', 'Platformer'], ['Online Co-op'], null, null, null, null, 410000, '$49.99'],
  [3600010, 'Brick Bash Arena', ['Multiplayer', 'Party Game', 'Physics', 'Funny', 'Low-poly', 'Destruction', 'Casual'], ['Multi-player', 'Online PvP'], null, null, null, null, 95000, '$6.99'],
  [3611200, 'Mimic Lobby', ['Social Deduction', 'Online Co-Op', 'Horror', 'Funny', 'Proximity Voice Chat', 'Stylized'], ['Multi-player', 'Online Co-op'], null, null, null, null, 140000, '$7.99'],
];

const state = { games: {} };
for (const [appid, name, tags, categories, ccu, owners, reviews, daysAgo, followers, price] of G) {
  const upcoming = daysAgo == null;
  const hist = [];
  if (ccu) {
    // 14 days of 3-hourly points with a daily wave and slight growth for young games
    for (let h = hourIndex - 14 * 24; h <= hourIndex; h += 3) {
      const age = (hourIndex - h) / 24;
      const wave = 0.75 + 0.25 * Math.sin((h % 24) / 24 * Math.PI * 2);
      const trend = daysAgo < 90 ? Math.max(0.3, 1 - age * 0.05) : 1;
      hist.push([h, Math.round(ccu * wave * trend)]);
    }
    hist[hist.length - 1][1] = ccu;
  }
  state.games[appid] = {
    appid,
    store: {
      type: 'game', name, header: img(appid), capsule: null, screenshots: [],
      short: `${name} is a sample entry used to preview the site. Real descriptions come from the Steam store.`,
      about: `This is mock data.\n\nRun the collector in GitHub Actions to fill the site with live Steam numbers, tags and Roblox copies.`,
      comingSoon: upcoming,
      releaseText: upcoming ? 'Coming soon' : fmtDate(now - daysAgo * D),
      price, isFree: price === 'Free', categories, genres: ['Action', 'Indie'], devs: ['Sample Studio'], pubs: ['Sample Studio'],
      requiredAge: 0, fetchedAt: now,
    },
    spy: { tags, owners: owners ? { low: owners[0], high: owners[1] } : null, positive: reviews ? Math.round(reviews * 0.9) : null, negative: reviews ? Math.round(reviews * 0.1) : null, fetchedAt: now },
    followers: followers ? { count: followers, fetchedAt: now } : null,
    roblox: name === 'Lethal Company'
      ? { fetchedAt: now, copies: [
          { universeId: 1, placeId: 15476322853, name: 'Lethal Business', players: 12, upVotes: 31709, downVotes: 2638, url: 'https://www.roblox.com/games/15476322853', icon: null },
          { universeId: 2, placeId: 1, name: 'Lethal Company [Roblox]', players: 830, upVotes: 9100, downVotes: 900, url: 'https://www.roblox.com/games/1', icon: null },
        ] }
      : name === 'Sprout Party' ? { fetchedAt: now, copies: [] } : null,
    ccu, peak: ccu ? Math.round(ccu * 1.4) : null, hist,
    wishlistRank: upcoming ? Object.keys(state.games).length + 1 : undefined,
  };
}

const counts = await writeOutputs(state, OUT_DIR, now);
console.log('Mock data written to', OUT_DIR, counts);
