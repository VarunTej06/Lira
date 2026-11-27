import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listAllGrants, type Grant, type Member } from '../../services/accessApi';
import { accessFor, initialsOf, reachSummary } from '../../utils/accessRows';
import { Avatar } from '../common/Avatar';
import { PeopleTab } from '../teams/PeopleTab';
import { ROLES } from '../teams/teamsUi';
import { AccessSection } from './AccessSection';
import { IdentityGate, type ReadyData } from './IdentityGate';

const roleLabel = (role: string): string => (role === 'owner' ? 'Owner' : ROLES.find(r => r.value === role)?.label ?? role);
const reaches = (m: Member): boolean => m.role === 'owner' || m.role === 'admin';

function Stat({ value, label }: { value: number; label: string }) {
  return <div className="bg-white border border-lira-border rounded-xl px-4 py-2.5 min-w-28"><b className="block text-xl text-lira-text">{value}</b><span className="text-2xs text-lira-muted">{label}</span></div>;
}

/** One person: who they are, their teams, and everything they can reach, grouped and changeable. */
function PersonPanel({ r, member, close }: { r: ReadyData; member: Member; close: () => void }) {
  const inTeams = r.teams.filter(t => member.teamIds.includes(t.id));
  return (
    <section aria-label="Person" className="bg-white border border-lira-border rounded-2xl p-4 space-y-4 self-start">
      <div className="flex items-start gap-3">
        <Avatar initials={initialsOf(member.name, member.email)} size="lg" />
        <div className="flex-1 min-w-0"><h2 className="text-lg font-bold text-lira-text truncate">{member.name}</h2><p className="text-ui text-lira-muted truncate">{member.email}</p></div>
        <button type="button" onClick={close} className="text-ui underline">Close</button>
      </div>
      <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-ui"><dt className="text-lira-muted">Role</dt><dd>{roleLabel(member.role)}</dd><dt className="text-lira-muted">Teams</dt><dd>{inTeams.length ? inTeams.map(t => t.name).join(', ') : 'None'}</dd></dl>
      <AccessSection org={r.org} subject={{ type: 'user', id: member.userId, teamIds: member.teamIds }} teams={r.teams} everything={reaches(member)} />
    </section>
  );
}

function UsersBody({ r, selected }: { r: ReadyData; selected: string | undefined }) {
  const navigate = useNavigate();
  const [grants, setGrants] = useState<Grant[]>([]);
  useEffect(() => {
    let current = true;
    void listAllGrants(r.org).then(g => { if (current && g.ok) setGrants(g.data); });
    return () => { current = false; };
  }, [r.org, r.members]);
  const reach = Object.fromEntries(r.members.map(m => [m.userId, reaches(m) ? 'Everything' : reachSummary(accessFor({ type: 'user', id: m.userId, teamIds: m.teamIds }, grants, r.teams))]));
  const member = r.members.find(m => m.userId === selected);

  return (
    <div className="space-y-5">
      <header><h2 className="text-lg font-bold text-lira-text">Your people</h2><p className="text-ui text-lira-muted">Who is in this workspace, and what each person can reach. Open a person to see and change it.</p></header>
      <div className="flex flex-wrap gap-3"><Stat value={r.members.length} label="people" /><Stat value={r.teams.length} label="teams" /><Stat value={r.invitations.length} label="waiting to join" /></div>
      <div className={`grid gap-5 ${selected ? 'xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]' : ''}`}>
        <PeopleTab org={r.org} role={r.role} members={r.members} teams={r.teams} invitations={r.invitations} reload={r.reload} onOpen={id => navigate(`/settings/users/${id}`)} reach={reach} selectedId={selected} />
        {selected && (member
          ? <PersonPanel key={member.userId} r={r} member={member} close={() => navigate('/settings/users')} />
          : <p role="alert" className="text-ui">That person is not in this organisation. <button type="button" onClick={() => navigate('/settings/users')} className="underline">Back to users</button></p>)}
      </div>
    </div>
  );
}

export function UsersPage() {
  const { userId } = useParams();
  return <IdentityGate>{r => <UsersBody r={r} selected={userId} />}</IdentityGate>;
}
