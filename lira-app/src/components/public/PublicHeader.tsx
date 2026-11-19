import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LiraLogo } from '../common/LiraLogo';
import { NAV, isMenu } from './navContent';
import { NavMenu, NAV_TEXT } from './NavMenu';
import { SiteLink } from './SiteLink';
import { SiteSearch } from './SiteSearch';
import { ThemeToggle } from './ThemeToggle';
import { BTN } from './styles';

/** The top bar of the public pages. It is fixed: the page scrolls beneath it. The logo is set in from the edge, not against it. */
export function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-lira-bg border-b border-lira-border">
      <div className="flex items-center gap-3 min-h-16 px-4 sm:px-10 lg:px-24">
        <Link to="/" aria-label="Liraspaces" className="inline-flex items-center gap-2.5 text-lira-text font-bold text-lg tracking-tight mr-2 lg:mr-6">
          <LiraLogo className="w-8 h-8" />
          <span className="hidden sm:inline">Liraspaces</span>
        </Link>
        <nav aria-label="Main" className="hidden md:flex items-center gap-1">
          {NAV.map(entry => isMenu(entry)
            ? <NavMenu key={entry.label} label={entry.label} items={entry.items} />
            : <SiteLink key={entry.label} to={entry.to} className={NAV_TEXT}>{entry.label}</SiteLink>)}
        </nav>
        <div className="flex-1" />
        <ThemeToggle />
        <SiteSearch />
        <Link to="/login" className="hidden sm:inline text-ui font-bold text-lira-text px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lira-blue rounded">Sign in</Link>
        <Link to="/signup" className={`${BTN} rounded-xl`}>Get it free</Link>
        <button type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)} className={`md:hidden ${NAV_TEXT}`}>Menu</button>
      </div>
      {menuOpen && (
        <nav aria-label="Menu" className="md:hidden border-t border-lira-border px-4 py-2 flex flex-col">
          {NAV.flatMap(entry => (isMenu(entry) ? entry.items : [entry])).map(item => (
            <SiteLink key={`${item.label}${item.to}`} to={item.to} onClick={() => setMenuOpen(false)} className="py-2 text-ui text-lira-text">{item.label}</SiteLink>
          ))}
          <Link to="/login" onClick={() => setMenuOpen(false)} className="py-2 text-ui font-bold text-lira-text">Sign in</Link>
        </nav>
      )}
    </header>
  );
}
