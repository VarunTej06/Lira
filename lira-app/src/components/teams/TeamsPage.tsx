import { useState } from 'react';
import { activeOrg } from '../../utils/hostedOrg';
import { Skeleton } from '../common/Skeleton';
import { AccessTab } from './AccessTab';
import { ImportTab } from './ImportTab';
import { PeopleTab } from './PeopleTab';
import { TeamsTab } from './TeamsTab';
import { useTeamsData } from './useTeamsData';

const TABS = [{ id: 'people', label: 'People' }, { id: 'teams', label: 'Teams' }, { id: 'access', label: 'Access' }, { id: 'import', label: 'Import' }] as const;
type TabId = (typeof TABS)[number]['id'];

/**
 * Hosted edition: bring people in, group them into teams, and say who may view, edit or manage each space, project, roadmap or
 * dashboard. The page only asks the server; every change is checked there again for the person making it.
 */
export function TeamsPage() {
  const org = activeOrg();
  const [data, reload] = useTeamsData();
  const [tab, setTab] = useState<TabId>('people');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <header>
        <h1 className="text-xl font-bold text-lira-text">Teams and access</h1>
        <p className="text-ui text-lira-muted">Invite people, group them into teams, and choose what each person or team can reach.</p>
      </header>

      {data.state === 'loading' && <div role="status" aria-label="Loading people and teams" className="space-y-2"><Skeleton className="h-8 w-64" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>}
      {data.state === 'denied' && <p role="alert" className="text-ui">You do not have access to manage people and teams here. Ask the owner of this organisation.</p>}
      {data.state === 'error' && <p role="alert" className="text-ui text-red-600">{data.message} <button type="button" onClick={reload} className="underline">Try again</button></p>}

      {data.state === 'ready' && org && (
        <>
          <div role="tablist" aria-label="Sections" className="flex gap-1 border-b border-lira-border">
            {TABS.map(t => (
              <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-ui font-bold border-b-2 -mb-px ${tab === t.id ? 'border-lira-blue text-lira-text' : 'border-transparent text-lira-muted hover:text-lira-text'}`}>{t.label}</button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === 'people' && <PeopleTab org={org} role={data.role} members={data.members} teams={data.teams} invitations={data.invitations} reload={reload} />}
            {tab === 'teams' && <TeamsTab org={org} members={data.members} teams={data.teams} reload={reload} />}
            {tab === 'import' && <ImportTab org={org} />}
            {tab === 'access' && <AccessTab org={org} members={data.members} teams={data.teams} />}
          </div>
        </>
      )}
    </div>
  );
}
