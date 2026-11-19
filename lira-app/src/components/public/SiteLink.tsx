import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** A link inside the public site. A section on the landing page (`/#inside`) is a plain link so the browser scrolls to it. */
export function SiteLink({ to, className, onClick, children }: { to: string; className?: string; onClick?: () => void; children: ReactNode }) {
  return to.startsWith('/#')
    ? <a href={to} className={className} onClick={onClick}>{children}</a>
    : <Link to={to} className={className} onClick={onClick}>{children}</Link>;
}
