export type Range = { low: number; high: number };

export type CardBase = { appid: number; name: string; img: string | null; tags: string[] };

export type PopularItem = CardBase & { ccu: number; peak: number | null; owners: Range | null; reviews: number | null; growth24h: number | null };
export type RisingItem = CardBase & {
  ccu: number | null; peak: number | null; days: number; reviews: number | null; reviewsPerDay: number | null;
  growth24h: number | null; growth7d: number | null; owners: Range | null;
};
export type UpcomingItem = CardBase & { followers: number | null; wishlistEst: Range | null; releaseText: string; wishlistRank: number | null };
export type RobloxItem = CardBase & {
  score: number; parts: [number, number][]; strengths: string[]; copies: number | null; ccu: number | null; released: boolean;
};

export type Lists = {
  meta: { updatedAt: number; tracked: number };
  popular: PopularItem[];
  rising: RisingItem[];
  upcoming: UpcomingItem[];
  roblox: RobloxItem[];
};

export type ScorePart = { key: string; label: string; score: number; max: number; hits: string[] };
export type RobloxScore = { total: number; parts: ScorePart[]; flags: string[] };

export type RobloxCopy = {
  universeId: number; placeId: number; name: string; players: number; upVotes: number; downVotes: number; url: string; icon: string | null;
};

export type GameDetail = {
  appid: number;
  name: string;
  header: string | null;
  capsule: string | null;
  screenshots: string[];
  short: string;
  about: string;
  tags: string[];
  categories: string[];
  genres: string[];
  devs: string[];
  pubs: string[];
  price: string | null;
  releaseText: string;
  released: boolean;
  daysSinceRelease: number | null;
  ccu: number | null;
  peak: number | null;
  avg7d: number | null;
  growth24h: number | null;
  growth7d: number | null;
  owners: Range | null;
  reviews: number | null;
  reviewScore: number | null;
  reviewsPerDay: number | null;
  followers: number | null;
  wishlistEst: Range | null;
  roblox: RobloxScore;
  robloxCopies: RobloxCopy[] | null;
  hist: [number, number][];
  updatedAt: number;
  live?: boolean; // fetched through the proxy, not from the tracked database
};

export type SearchHit = { appid: number; name: string; img?: string; tracked: boolean };
