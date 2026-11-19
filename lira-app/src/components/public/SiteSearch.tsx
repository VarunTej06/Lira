import { useEffect, useRef, useState } from 'react';
import { useDismiss } from '../../hooks/useDismiss';
import { SearchIcon } from './icons';
import { searchSite } from './pageSearch';
import { SiteLink } from './SiteLink';

/** The magnifier of the top bar: it opens a small box that finds a public page or section. */
export function SiteSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useDismiss(open, setOpen, panel, trigger);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  const results = searchSite(query);
  const close = () => { setOpen(false); setQuery(''); };
  return (
    <div className="relative">
      <button ref={trigger} type="button" aria-label="Search" aria-expanded={open} onClick={() => setOpen(o => !o)}
        className="w-10 h-10 rounded-full flex items-center justify-center text-lira-text bg-gray-100 hover:bg-gray-200 transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lira-blue">
        <SearchIcon />
      </button>
      {open && (
        <div ref={panel} className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-lira-surface border border-lira-border rounded-lg p-2 z-50 flex flex-col gap-1">
          <label htmlFor="site-search" className="sr-only">Search Liraspaces</label>
          <input id="site-search" ref={input} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search pages"
            className="bg-lira-bg border border-lira-border rounded px-3 py-2 text-ui text-lira-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-lira-blue" />
          {query.trim() && results.length === 0 && <p role="status" className="px-3 py-2 text-ui text-lira-muted">Nothing found for "{query.trim()}".</p>}
          {results.map(r => (
            <SiteLink key={r.title} to={r.to} onClick={close} className="px-3 py-2 rounded hover:bg-gray-100 flex flex-col">
              <span className="text-ui font-medium text-lira-text">{r.title}</span>
              <span className="text-xs text-lira-muted">{r.text}</span>
            </SiteLink>
          ))}
        </div>
      )}
    </div>
  );
}
