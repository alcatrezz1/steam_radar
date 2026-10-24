import { useRoute } from './lib/router';
import { Search } from './components/Search';
import { ListPage } from './pages/ListPage';
import { GamePage } from './pages/GamePage';

const NAV = [
  { href: '#/', page: 'popular', label: 'Popular' },
  { href: '#/rising', page: 'rising', label: 'Rising' },
  { href: '#/upcoming', page: 'upcoming', label: 'Upcoming' },
  { href: '#/roblox', page: 'roblox', label: 'Roblox fit' },
] as const;

function Logo() {
  return (
    <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="7.5" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <path className="logo-sweep" d="M16 16 L16 3 A13 13 0 0 1 28.4 12 Z" fill="var(--amber)" />
      <circle cx="16" cy="16" r="2.2" fill="var(--amber)" />
    </svg>
  );
}

export function App() {
  const route = useRoute();
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#/">
            <Logo />
            <span>Steam Radar</span>
          </a>
          <nav className="nav" aria-label="Lists">
            {NAV.map((n) => (
              <a key={n.page} href={n.href} className={route.page === n.page ? 'is-current' : ''} aria-current={route.page === n.page ? 'page' : undefined}>
                {n.label}
              </a>
            ))}
          </nav>
          <Search />
        </div>
      </header>

      {route.page === 'game' ? (
        <GamePage appid={route.appid} />
      ) : route.page === 'notfound' ? (
        <main className="page"><div className="empty"><h2>Page not found</h2><a className="button" href="#/">Go to popular games</a></div></main>
      ) : (
        <ListPage key={route.page} kind={route.page} />
      )}

      <footer className="footer">
        Data from the Steam Web API, Steam store, SteamSpy and Roblox search. Owner and wishlist numbers are estimates.
        Not affiliated with Valve or Roblox.
      </footer>
    </>
  );
}
