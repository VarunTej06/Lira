import type { ReactNode } from 'react';
import { PublicHeader } from './PublicHeader';
import { SiteFooter } from './SiteFooter';

/** The frame of every public page: the fixed top bar, the page, and the footer. */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-lira-bg text-lira-text text-sm">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
