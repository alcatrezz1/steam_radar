import { useState } from 'react';

// Steam image with a fallback chain: given url -> classic CDN header -> name plate.
export function Cover({ appid, src, name, className }: { appid: number; src: string | null; name: string; className?: string }) {
  const urls = [src, `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`].filter(Boolean) as string[];
  const [i, setI] = useState(0);
  if (i >= urls.length) {
    return (
      <div className={`cover cover-empty ${className || ''}`} aria-label={name}>
        <span>{name}</span>
      </div>
    );
  }
  return <img className={`cover ${className || ''}`} src={urls[i]} alt="" loading="lazy" onError={() => setI(i + 1)} />;
}
