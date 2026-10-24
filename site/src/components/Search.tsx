import { useEffect, useRef, useState } from 'react';
import { searchLocal, searchSteam } from '../lib/data';
import { PROXY } from '../lib/config';
import { go } from '../lib/router';
import type { SearchHit } from '../lib/types';

export function Search() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<SearchHit[]>([]);
  const [steam, setSteam] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // Local results are instant, Steam results wait for a pause in typing.
  useEffect(() => {
    let alive = true;
    searchLocal(q).then((r) => alive && setLocal(r));
    setActive(0);
    if (!PROXY || q.trim().length < 2) {
      setSteam([]);
      return () => { alive = false; };
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      searchSteam(q, ctrl.signal)
        .then((r) => alive && setSteam(r))
        .catch(() => alive && setSteam([]))
        .finally(() => alive && setLoading(false));
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const slash = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', slash);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', slash);
    };
  }, []);

  const trackedIds = new Set(local.map((h) => h.appid));
  const steamOnly = steam.filter((h) => !trackedIds.has(h.appid));
  const hits = [...local, ...steamOnly];
  const steamSearchUrl = `https://store.steampowered.com/search/?term=${encodeURIComponent(q.trim())}`;

  const pick = (h: SearchHit) => {
    setOpen(false);
    setQ('');
    input.current?.blur();
    // Without a proxy only tracked games have a detail page here.
    if (h.tracked || PROXY) go(`/game/${h.appid}`);
    else window.open(`https://store.steampowered.com/app/${h.appid}`, '_blank', 'noopener');
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
    else if (e.key === 'Enter') {
      if (hits[active]) pick(hits[active]);
      else if (q.trim()) window.open(steamSearchUrl, '_blank', 'noopener');
    }
  };

  const show = open && q.trim().length >= 2;

  return (
    <div className="search" ref={box}>
      <svg className="search-icon" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M13 13l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        ref={input}
        type="search"
        placeholder="Search any Steam game"
        aria-label="Search games"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        role="combobox"
        aria-expanded={show}
        aria-controls="search-results"
      />
      {show && (
        <div className="search-panel" id="search-results" role="listbox">
          {local.length > 0 && <p className="search-group">Tracked on Steam Radar</p>}
          {local.map((h, i) => (
            <button key={'l' + h.appid} role="option" aria-selected={i === active} className={`search-hit ${i === active ? 'is-active' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => pick(h)}>
              <img src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${h.appid}/capsule_sm_120.jpg`} alt="" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
              <span>{h.name}</span>
            </button>
          ))}
          {PROXY && (steamOnly.length > 0 || loading) && <p className="search-group">On Steam{loading ? ', searching' : ''}</p>}
          {steamOnly.map((h, j) => {
            const i = local.length + j;
            return (
              <button key={'s' + h.appid} role="option" aria-selected={i === active} className={`search-hit ${i === active ? 'is-active' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => pick(h)}>
                {h.img ? <img src={h.img} alt="" /> : <span className="search-noimg" />}
                <span>{h.name}</span>
              </button>
            );
          })}
          {!loading && hits.length === 0 && <p className="search-empty">No tracked game matches “{q.trim()}”.</p>}
          <a className="search-steam" href={steamSearchUrl} target="_blank" rel="noopener">
            Open “{q.trim()}” in the Steam store
          </a>
        </div>
      )}
    </div>
  );
}
