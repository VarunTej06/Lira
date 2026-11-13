import { isEditable } from '../../utils/isEditable';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Link2 } from 'lucide-react';
import { AnimatePresence, motion } from './motionPresets';
import { menuPop } from './motionPresets';
import { copyText } from './copyText';
import { notifySaved } from './savedToastStore';
import { flushDiskSync } from '../../services/localDiskSync';

/**
 * "Open in new tab" for every item that has a `data-href` (tickets, sprints, projects, roadmaps, spaces, pages).
 *   - right-click: the Lira link menu (Open in new tab, Copy link)
 *   - middle-click, or Ctrl / Cmd + click: opens the item in a new tab at once
 * Rendered once, near the top of the app.
 */

const hrefOf = (target: EventTarget | null): string | null => {
  const el = (target as HTMLElement | null)?.closest?.('[data-href]') as HTMLElement | null;
  return el?.getAttribute('data-href') ?? null;
};

const absolute = (href: string) => new URL(href, window.location.origin).toString();
/** Saves anything still waiting to be written, then opens the page in a new tab (which reads the same saved data). */
const openTab = (href: string) => { flushDiskSync(); window.open(absolute(href), '_blank', 'noopener'); };


export const LinkMenuHost: React.FC = () => {
  const [menu, setMenu] = useState<{ x: number; y: number; href: string } | null>(null);

  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      if (isEditable(e.target)) return;
      const href = hrefOf(e.target);
      if (!href) { setMenu(null); return; }
      e.preventDefault();
      const x = Math.min(e.clientX, window.innerWidth - 210);
      const y = Math.min(e.clientY, window.innerHeight - 110);
      setMenu({ x, y, href });
    };
    const onAux = (e: MouseEvent) => {
      if (e.button !== 1) return;
      const href = hrefOf(e.target);
      if (!href) return;
      e.preventDefault();
      openTab(href);
    };
    const onClick = (e: MouseEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.button !== 0) return;
      const href = hrefOf(e.target);
      if (!href) return;
      e.preventDefault();
      e.stopPropagation();
      openTab(href);
    };
    const onMiddleDown = (e: MouseEvent) => { if (e.button === 1 && hrefOf(e.target)) e.preventDefault(); }; // no auto-scroll cursor
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('auxclick', onAux);
    document.addEventListener('mousedown', onMiddleDown);
    document.addEventListener('click', onClick, true); // before the item's own click handler
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('auxclick', onAux);
      document.removeEventListener('mousedown', onMiddleDown);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (!menu) return;
    const away = (e: MouseEvent) => { if (!(e.target as HTMLElement | null)?.closest?.('[data-link-menu]')) setMenu(null); };
    document.addEventListener('mousedown', away, true);
    return () => document.removeEventListener('mousedown', away, true);
  }, [menu]);

  return createPortal(
    <AnimatePresence>
      {menu && (
        <motion.div
          key="link-menu"
          {...menuPop}
          data-link-menu
          role="menu"
          style={{ position: 'fixed', top: menu.y, left: menu.x, zIndex: 500, transformOrigin: 'top left' }}
          className="w-52 bg-white border border-lira-border rounded-xl shadow-2xl py-1 text-sm text-lira-text"
        >
          <button role="menuitem" data-testid="open-new-tab" onClick={() => { openTab(menu.href); setMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer text-left">
            <ExternalLink className="w-4 h-4 text-lira-muted" /> Open in new tab
          </button>
          <button role="menuitem" data-testid="copy-link" onClick={async () => { const ok = await copyText(absolute(menu.href)); setMenu(null); if (ok) notifySaved('Link copied'); }} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer text-left">
            <Link2 className="w-4 h-4 text-lira-muted" /> Copy link
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
