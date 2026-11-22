import type { ReactNode } from 'react';
import { PublicHeader } from './PublicHeader';
import { SiteFooter } from './SiteFooter';

/** Pages that are only a form and a picture: no top bar, no footer, nothing to search. */
const BARE_PATHS: readonly string[] = ['/login'];
/** Pages where a search box has nothing to find. The landing page is the only one that keeps it. */
const SEARCH_PATHS: readonly string[] = ['/', '/coming-soon'];

/** The frame of every public page: the fixed top bar, the page, and the footer. */
export function PublicLayout({ path, children }: { path: string; children: ReactNode }) {
  if (BARE_PATHS.includes(path)) return <div className="min-h-screen bg-lira-bg text-lira-text text-sm"><main>{children}</main></div>;
  return (
    <div className="min-h-screen flex flex-col bg-lira-bg text-lira-text text-sm">
      <PublicHeader showSearch={SEARCH_PATHS.includes(path)} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
