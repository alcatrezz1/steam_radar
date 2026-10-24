import { useEffect, useState } from 'react';

// Hash routing: GitHub Pages has no server rewrites, so #/game/730 survives a page reload.
export type Route =
  | { page: 'popular' | 'rising' | 'upcoming' | 'roblox' }
  | { page: 'game'; appid: number }
  | { page: 'notfound' };

export function parse(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  if (path === '/' || path === '/popular') return { page: 'popular' };
  if (path === '/rising') return { page: 'rising' };
  if (path === '/upcoming') return { page: 'upcoming' };
  if (path === '/roblox') return { page: 'roblox' };
  const m = path.match(/^\/game\/(\d+)/);
  if (m) return { page: 'game', appid: Number(m[1]) };
  return { page: 'notfound' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parse(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const go = (path: string) => {
  location.hash = path;
};
