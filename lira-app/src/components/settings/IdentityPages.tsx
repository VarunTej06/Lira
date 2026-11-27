import { useNavigate, useParams } from 'react-router-dom';
import { AccessTab } from '../teams/AccessTab';
import { ImportTab } from '../teams/ImportTab';
import { TeamsTab } from '../teams/TeamsTab';
import { AccessMatrix } from './AccessMatrix';
import { AccessSection } from './AccessSection';
import { IdentityGate } from './IdentityGate';

const Title = ({ children, hint }: { children: string; hint: string }) => <header><h2 className="text-lg font-bold text-lira-text">{children}</h2><p className="text-ui text-lira-muted">{hint}</p></header>;

export function TeamsListPage() {
  const navigate = useNavigate();
  return (
    <IdentityGate>{r => (
      <div className="space-y-5"><Title hint="Group people into teams, then open a team to see what it can reach.">Teams</Title>
        <TeamsTab org={r.org} members={r.members} teams={r.teams} reload={r.reload} onOpen={id => navigate(`/settings/teams/${id}`)} /></div>
    )}</IdentityGate>
  );
}

export function TeamDetailPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  return (
    <IdentityGate>{r => {
      const t = r.teams.find(x => x.id === teamId);
      if (!t) return <p role="alert" className="text-ui">That team does not exist. <button type="button" onClick={() => navigate('/settings/teams')} className="underline">Back to teams</button></p>;
      const people = r.members.filter(m => t.memberIds.includes(m.userId));
      return (
        <div className="space-y-5">
          <button type="button" onClick={() => navigate('/settings/teams')} className="text-ui underline">All teams</button>
          <header><h2 className="text-lg font-bold text-lira-text">{t.name}</h2><p className="text-ui text-lira-muted">{people.length} {people.length === 1 ? 'person' : 'people'}</p></header>
          <ul aria-label="Members" className="text-ui space-y-0.5">{people.map(m => <li key={m.userId}>{m.name} <span className="text-lira-muted">{m.email}</span></li>)}</ul>
          <AccessSection org={r.org} subject={{ type: 'team', id: t.id }} teams={r.teams} everything={false} />
        </div>
      );
    }}</IdentityGate>
  );
}

export function AccessPage() {
  return (
    <IdentityGate>{r => (
      <div className="space-y-5">
        <Title hint="Every person and team against every space, project, roadmap and dashboard. Change a cell to change who can reach it.">Who can reach what</Title>
        <AccessMatrix org={r.org} members={r.members} teams={r.teams} />
        <details className="border border-lira-border rounded-xl bg-white p-3">
          <summary className="cursor-pointer text-ui font-bold">Work on one thing in detail</summary>
          <div className="pt-3"><AccessTab org={r.org} members={r.members} teams={r.teams} /></div>
        </details>
      </div>
    )}</IdentityGate>
  );
}

export function ImportPage() {
  return <IdentityGate>{r => <div className="space-y-5"><Title hint="Bring in a workspace you kept in the local edition.">Import</Title><ImportTab org={r.org} /></div>}</IdentityGate>;
}
