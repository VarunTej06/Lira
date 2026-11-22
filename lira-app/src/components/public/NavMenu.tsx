import { useRef, useState } from 'react';
import { useDismiss } from '../../hooks/useDismiss';
import { ChevronIcon } from './icons';
import { SiteLink } from './SiteLink';
import type { NavItem } from './navContent';

export const NAV_TEXT = 'inline-flex items-center gap-1.5 px-2.5 py-2 text-ui font-medium text-lira-text hover:text-lira-muted transition-colors duration-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lira-blue rounded';

/** A drop-down of the top bar. It opens on a click and closes on Escape, on a click elsewhere, and when the page scrolls. */
export function NavMenu({ label, items }: { label: string; items: readonly NavItem[] }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useDismiss(open, setOpen, panel, trigger);
  return (
    <div className="relative">
      <button ref={trigger} type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(o => !o)} className={NAV_TEXT}>
        {label}<ChevronIcon />
      </button>
      {open && (
        <div ref={panel} role="menu" className="absolute left-0 top-full mt-2 min-w-56 bg-lira-surface border border-lira-border rounded-lg p-1.5 z-50 flex flex-col">
          {items.map(item => (
            <SiteLink key={item.label} to={item.to} onClick={() => setOpen(false)} className="px-3 py-2 rounded text-ui text-lira-text hover:bg-gray-100">{item.label}</SiteLink>
          ))}
        </div>
      )}
    </div>
  );
}
