import { Link } from 'react-router-dom';
import { LiraLogo } from '../common/LiraLogo';
import { CONTACT_EMAIL, OPERATOR_NAME } from './legalText';
import { SiteLink } from './SiteLink';
import { LINK } from './styles';

const COLUMNS: readonly { heading: string; links: readonly { label: string; to: string }[] }[] = [
  { heading: 'PRODUCT', links: ['Boards and tickets', 'Sprints', 'Roadmaps', 'Dashboards', 'Viva'].map(label => ({ label, to: '/#inside' })) },
  { heading: 'RESOURCES', links: [{ label: 'Guides', to: '/coming-soon' }, { label: 'Templates', to: '/coming-soon' }] },
  { heading: 'LEGAL', links: [{ label: 'Terms of Service', to: '/terms' }, { label: 'Privacy Policy', to: '/privacy' }, { label: 'User Notice', to: '/notice' }] },
];

/** The large footer: a grey panel with the logo, the contact, and the product, resource and legal links. */
export function SiteFooter() {
  return (
    <footer className="px-4 sm:px-10 pb-8 pt-4">
      <div className="max-w-6xl mx-auto bg-gray-100 rounded-2xl p-6 sm:p-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 text-ui">
        <div className="flex flex-col gap-4">
          <Link to="/" aria-label="Liraspaces" className="inline-flex items-center gap-2.5 text-lira-text font-bold text-lg"><LiraLogo className="w-8 h-8" motion="none" />Liraspaces</Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className={`${LINK} font-bold`}>Contact us</a>
          <small className="text-lira-muted">Operated by {OPERATOR_NAME}, India</small>
        </div>
        {COLUMNS.map(col => (
          <nav key={col.heading} aria-label={col.heading} className="flex flex-col gap-3">
            <p className="text-xs font-bold tracking-widest">{col.heading}</p>
            {col.links.map(link => <SiteLink key={link.label} to={link.to} className="text-lira-muted hover:text-lira-text">{link.label}</SiteLink>)}
          </nav>
        ))}
      </div>
    </footer>
  );
}
