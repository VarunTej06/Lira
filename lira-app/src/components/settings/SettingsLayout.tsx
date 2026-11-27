import { NavLink, Outlet } from 'react-router-dom';
import { activeOrg } from '../../utils/hostedOrg';
import { visibleGroups } from '../../utils/settingsNav';
import { useTeamsData } from '../teams/useTeamsData';

/**
 * Hosted edition Settings: a rail of pages on the left and the chosen page on the right. The pages that manage people and access appear
 * only when the server says the person may manage access; the server checks again on every call.
 */
export function SettingsLayout() {
  const org = activeOrg();
  const [data, reload] = useTeamsData();
  const groups = visibleGroups(data.state === 'ready');
  return (
    <div className="flex flex-col md:flex-row gap-6 p-6 max-w-6xl mx-auto">
      <nav aria-label="Settings" className="md:w-56 flex-shrink-0 space-y-4">
        <h1 className="text-xl font-bold text-lira-text">Settings</h1>
        {groups.map(g => (
          <div key={g.title}>
            <h2 className="text-3xs font-bold uppercase tracking-wide text-lira-muted mb-1">{g.title}</h2>
            <ul className="space-y-0.5">
              {g.items.map(i => (
                <li key={i.id}>
                  <NavLink to={i.path} className={({ isActive }) => `block rounded px-2 py-1.5 text-ui ${isActive ? 'bg-lira-blue-light font-bold text-lira-text' : 'text-lira-muted hover:text-lira-text hover:bg-gray-50'}`}>{i.label}</NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <main className="flex-1 min-w-0 space-y-5">
        {org ? <Outlet context={{ org, data, reload }} /> : <p role="alert" className="text-ui">You are not signed in to an organisation.</p>}
      </main>
    </div>
  );
}
