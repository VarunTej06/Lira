import { useNavigate, useParams } from 'react-router-dom';
import { AccessTab } from '../teams/AccessTab';
import { ImportTab } from '../teams/ImportTab';
import { PeopleTab } from '../teams/PeopleTab';
import { TeamsTab } from '../teams/TeamsTab';
import { ROLES } from '../teams/teamsUi';
import { AccessSection } from './AccessSection';
import { IdentityGate } from './IdentityGate';

const Title = ({ children, hint }: { children: string; hint: string }) => <header><h2 className="text-lg font-bold text-lira-text">{children}</h2><p className="text-ui text-lira-muted">{hint}</p></header>;
const roleLabel = (role: string): string => (role === 'owner' ? 'Owner' : ROLES.find(r => r.value === role)?.label ?? role);

export function UsersPage() {
  const navigate = useNavigate();
  return (
    <IdentityGate>{r => (
      <div className="space-y-5"><Title hint="Invite people, set their role, and open a person to see what they can reach.">Users</Title>
        <PeopleTab org={r.org} role={r.role} members={r.members} teams={r.teams} invitations={r.invitations} reload={r.reload} onOpen={id => navigate(`/settings/users/${id}`)} /></div>
    )}</IdentityGate>
  );
}

export function UserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  return (
    <IdentityGate>{r => {
      const m = r.members.find(x => x.userId === userId);
      if (!m) return <p role="alert" className="text-ui">That person is not in this organisation. <button type="button" onClick={() => navigate('/settings/users')} className="underline">Back to users</button></p>;
      const inTeams = r.teams.filter(t => m.teamIds.includes(t.id));
      return (
        <div className="space-y-5">
          <button type="button" onClick={() => navigate('/settings/users')} className="text-ui underline">All users</button>
          <header><h2 className="text-lg font-bold text-lira-text">{m.name}</h2><p className="text-ui text-lira-muted">{m.email}</p></header>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-ui"><dt className="text-lira-muted">Role</dt><dd>{roleLabel(m.role)}</dd><dt className="text-lira-muted">Teams</dt><dd>{inTeams.length ? inTeams.map(t => t.name).join(', ') : 'None'}</dd></dl>
          <AccessSection org={r.org} subject={{ type: 'user', id: m.userId, teamIds: m.teamIds }} teams={r.teams} everything={m.role === 'owner' || m.role === 'admin'} />
        </div>
      );
    }}</IdentityGate>
  );
}

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
  return <IdentityGate>{r => <div className="space-y-5"><Title hint="Choose a space, project, roadmap or dashboard and say who may reach it.">Access</Title><AccessTab org={r.org} members={r.members} teams={r.teams} /></div>}</IdentityGate>;
}

export function ImportPage() {
  return <IdentityGate>{r => <div className="space-y-5"><Title hint="Bring in a workspace you kept in the local edition.">Import</Title><ImportTab org={r.org} /></div>}</IdentityGate>;
}
