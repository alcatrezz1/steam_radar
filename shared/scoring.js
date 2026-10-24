// Roblox portability score (0-100).
// Shared by the data collector (Node) and the site (browser), so keep it dependency-free.
//
// Input:
//   tags        - array of Steam user tags, most voted first
//   categories  - array of Steam store category names ("Online Co-op", "Single-player", ...)
//   genres      - array of Steam store genre names
//   requiredAge - number from store details (0 if none)
//   robloxCopies - array of { players, upVotes } or null when not checked yet
//
// Output: { total, parts: [{ key, label, score, max, hits: [] }], flags: [] }

const tagWeight = (tags, name) => {
  const i = tags.indexOf(name);
  if (i < 0) return 0;
  // Top tags describe the game best. Tag #1 counts fully, tag #20 about a quarter.
  return Math.max(0.25, 1 - i / 25);
};

// Sum of weighted hits, returns { value, hits }
const match = (tags, table) => {
  let value = 0;
  const hits = [];
  for (const [name, pts] of Object.entries(table)) {
    const w = tagWeight(tags, name);
    if (w > 0) {
      value += pts * w;
      hits.push(name);
    }
  }
  return { value, hits };
};

const clamp = (v, max) => Math.round(Math.max(0, Math.min(max, v)));

const GRAPHICS_SIMPLE = {
  'Pixel Graphics': 8, 'Low-poly': 9, 'Stylized': 6, 'Cartoony': 7, 'Cartoon': 6,
  'Minimalist': 8, '2D': 5, 'Colorful': 4, 'Cute': 4, 'Voxel': 9, 'Abstract': 5,
  'Hand-drawn': 3, 'Top-Down': 3, 'Retro': 4, 'PS1': 7,
};
const GRAPHICS_HEAVY = {
  'Realistic': 9, 'Beautiful': 5, 'Cinematic': 6, 'Open World': 4, 'Photorealistic': 10,
  'Atmospheric': 2, 'Military': 3, 'Simulation': 2,
};

const SCOPE_SIMPLE = {
  'Arcade': 6, 'Casual': 5, 'Party Game': 7, 'Minigames': 7, 'Physics': 4, 'Platformer': 4,
  'Puzzle': 3, 'Clicker': 7, 'Idle': 6, 'Racing': 3, 'Parkour': 5, 'Hero Shooter': 2,
  'Shooter': 2, 'Precision Platformer': 5, 'Sandbox': 2, 'Social Deduction': 6,
};
const SCOPE_HEAVY = {
  'RPG': 5, 'Open World': 6, 'Grand Strategy': 10, '4X': 10, 'MMORPG': 10, 'City Builder': 7,
  'Colony Sim': 8, 'Strategy': 4, 'Story Rich': 5, 'Choices Matter': 5, 'Crafting': 2,
  'Base Building': 3, 'Management': 5, 'Turn-Based Tactics': 6, 'Massively Multiplayer': 6,
  'Souls-like': 5, 'CRPG': 9, 'JRPG': 7, 'Automation': 7, 'Space Sim': 6, 'Flight': 5,
  'Economy': 4, 'Political Sim': 8, 'Wargame': 8, 'RTS': 6, 'Immersive Sim': 7,
};

const MP_ONLINE_CATEGORIES = ['Online Co-op', 'Online PvP', 'MMO', 'Multi-player', 'Cross-Platform Multiplayer'];
const MP_LOCAL_CATEGORIES = ['Shared/Split Screen', 'Shared/Split Screen Co-op', 'Shared/Split Screen PvP', 'LAN Co-op', 'LAN PvP'];
const MP_TAGS = {
  'Online Co-Op': 10, 'Multiplayer': 8, 'PvP': 8, 'Co-op': 6, 'Party Game': 8,
  'Massively Multiplayer': 8, 'Team-Based': 6, 'Battle Royale': 8, 'PvE': 3,
  'Social Deduction': 8, 'Asymmetric VR': 2, '4 Player Local': 2,
};

const SESSION_SHORT = {
  'Party Game': 5, 'Roguelite': 4, 'Roguelike': 3, 'Arcade': 4, 'Battle Royale': 4,
  'Fast-Paced': 3, 'Minigames': 5, 'Replay Value': 3, 'Short': 5, 'Social Deduction': 4,
  'Arena Shooter': 3, 'Score Attack': 4,
};
const SESSION_LONG = {
  'Story Rich': 5, 'Open World': 4, 'RPG': 3, 'Grand Strategy': 5, 'MMORPG': 4,
  'Colony Sim': 4, 'Life Sim': 3,
};

const AUDIENCE_GOOD = {
  'Funny': 4, 'Cute': 4, 'Family Friendly': 5, 'Colorful': 3, 'Casual': 3, 'Physics': 3,
  'Horror': 3, 'Comedy': 3, 'Cartoony': 3, 'Sandbox': 2, 'Anime': 2, 'Superhero': 2,
  'Simulation': 1, 'Building': 2,
};
const AUDIENCE_BAD = {
  'Gore': 5, 'Sexual Content': 10, 'Nudity': 10, 'Mature': 6, 'Violent': 2,
  'Psychological Horror': 2, 'Hentai': 15, 'NSFW': 15, 'Dating Sim': 5,
};

const VIRAL = {
  'Funny': 4, 'Physics': 4, 'Memes': 5, 'Comedy': 3, 'Party Game': 3, 'Social Deduction': 4,
  'Horror': 2, 'Online Co-Op': 2, 'Difficult': 3, 'Parkour': 2, 'Destruction': 3,
  'Precision Platformer': 2, 'Psychological Horror': 1, 'Proximity Voice Chat': 5, 'Rage Game': 4,
};

const ADULT_ONLY_TAGS = ['Sexual Content', 'Nudity', 'Hentai', 'NSFW'];

// A copy only "takes" the niche if someone actually plays it.
const isRealCopy = (c) => (c.players || 0) >= 50 || (c.upVotes || 0) >= 2000;

export function scoreRoblox({ tags = [], categories = [], genres = [], requiredAge = 0, robloxCopies = null }) {
  const parts = [];
  const flags = [];
  // Genres act as weak tags when SteamSpy has no tags (often for unreleased games).
  const t = tags.length ? tags : genres;

  // 1. Simple graphics (20)
  {
    const good = match(t, GRAPHICS_SIMPLE);
    const bad = match(t, GRAPHICS_HEAVY);
    parts.push({
      key: 'graphics', label: 'Simple graphics', max: 20,
      score: clamp(10 + good.value - bad.value, 20),
      hits: [...good.hits, ...bad.hits.map((h) => '-' + h)],
    });
  }

  // 2. Few mechanics (20)
  {
    const good = match(t, SCOPE_SIMPLE);
    const bad = match(t, SCOPE_HEAVY);
    parts.push({
      key: 'scope', label: 'Few mechanics', max: 20,
      score: clamp(12 + good.value - bad.value, 20),
      hits: [...good.hits, ...bad.hits.map((h) => '-' + h)],
    });
  }

  // 3. Multiplayer (20)
  {
    const online = categories.some((c) => MP_ONLINE_CATEGORIES.includes(c));
    const local = categories.some((c) => MP_LOCAL_CATEGORIES.includes(c));
    const fromTags = match(t, MP_TAGS);
    let score = fromTags.value * 1.2;
    if (online) score = Math.max(score, 14) + 4;
    else if (local) score = Math.max(score, 6);
    const hits = [...fromTags.hits];
    if (online) hits.push('Online multiplayer');
    else if (local) hits.push('Local multiplayer only');
    if (!online && !local && fromTags.value === 0) hits.push('Single-player only');
    parts.push({ key: 'multiplayer', label: 'Multiplayer', max: 20, score: clamp(score, 20), hits });
  }

  // 4. Short sessions (10)
  {
    const good = match(t, SESSION_SHORT);
    const bad = match(t, SESSION_LONG);
    parts.push({
      key: 'session', label: 'Short sessions', max: 10,
      score: clamp(5 + good.value - bad.value, 10),
      hits: [...good.hits, ...bad.hits.map((h) => '-' + h)],
    });
  }

  // 5. Roblox audience fit (10)
  {
    const good = match(t, AUDIENCE_GOOD);
    const bad = match(t, AUDIENCE_BAD);
    let score = 5 + good.value - bad.value;
    if (requiredAge >= 17) score -= 4;
    parts.push({
      key: 'audience', label: 'Roblox audience fit', max: 10, score: clamp(score, 10),
      hits: [...good.hits, ...bad.hits.map((h) => '-' + h), ...(requiredAge >= 17 ? ['-Age ' + requiredAge + '+'] : [])],
    });
  }

  // 6. Viral potential (10)
  {
    const good = match(t, VIRAL);
    parts.push({ key: 'viral', label: 'Viral potential', max: 10, score: clamp(2 + good.value, 10), hits: good.hits });
  }

  // 7. Free niche (10)
  {
    let score;
    const hits = [];
    if (!robloxCopies) {
      score = 5;
      hits.push('Not checked yet');
    } else {
      const real = robloxCopies.filter(isRealCopy);
      const big = real.some((c) => (c.players || 0) >= 5000);
      score = real.length === 0 ? 10 : real.length === 1 ? 7 : real.length <= 3 ? 4 : 1;
      if (big) score = Math.min(score, 2);
      hits.push(real.length === 0 ? 'No active copies' : `${real.length} active cop${real.length === 1 ? 'y' : 'ies'}`);
      if (big) hits.push('A copy has 5k+ players');
    }
    parts.push({ key: 'niche', label: 'Free niche', max: 10, score, hits });
  }

  let total = parts.reduce((s, p) => s + p.score, 0);

  // Content Roblox would not allow: heavy penalty instead of a hidden filter.
  if (ADULT_ONLY_TAGS.some((n) => t.includes(n))) {
    total = Math.round(total * 0.4);
    flags.push('Adult content, not allowed on Roblox as is');
  }
  if (t.includes('Gore') && tagWeight(t, 'Gore') > 0.6) {
    flags.push('Heavy gore, needs to be toned down');
  }

  return { total: Math.max(0, Math.min(100, total)), parts, flags };
}

// Shared name matcher for Roblox search results.
// Returns true when a Roblox game name looks like a copy of the Steam title.
export function looksLikeCopy(steamName, robloxName) {
  const norm = (s) => s.toLowerCase().replace(/[™®©:!?'".,\-–—()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'in', 'on', 'to', 'game', 'simulator', 'online', 'edition', 'remastered']);
  const words = norm(steamName).split(' ').filter((w) => w.length > 2 && !STOP.has(w));
  const target = norm(robloxName);
  // Titles like "R.E.P.O." collapse to single letters, so also compare with all spaces removed.
  const compact = (s) => norm(s).replace(/ /g, '');
  const sc = compact(steamName);
  if (sc.length >= 3 && compact(robloxName).includes(sc)) return true;
  if (!words.length) return false;
  const found = words.filter((w) => target.includes(w)).length;
  // One-word titles need that word; longer titles need most of the words.
  return words.length === 1 ? found === 1 : found / words.length >= 0.5;
}
