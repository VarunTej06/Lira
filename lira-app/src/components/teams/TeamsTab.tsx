import { useState } from 'react';
import { createTeam, deleteTeam, setTeamMembers, type Member, type Team } from '../../services/accessApi';
import { confirmDialog } from '../common/dialogStore';
import { BUTTON, FIELD } from './teamsUi';

interface Props { org: string; members: Member[]; teams: Team[]; reload: () => void; /** When given, a team's name opens its own page. */ onOpen?: (teamId: string) => void }

/** One card per team: who is in it, saved with one button, and a way to delete it. A team can then be given access like a person. */
export function TeamsTab({ org, members, teams, reload, onOpen }: Props) {
  const [name, setName] = useState('');
  const [problem, setProblem] = useState('');

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setProblem('');
    const r = await createTeam(org, name.trim());
    if (r.ok) { setName(''); reload(); } else setProblem(r.fields?.name ?? r.message);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={e => { void add(e); }} className="flex items-end gap-2" aria-label="Create a team">
        <label className="flex flex-col gap-1 text-ui">Team name<input required value={name} onChange={e => setName(e.target.value)} className={`${FIELD} w-64`} /></label>
        <button type="submit" className={BUTTON}>Create team</button>
      </form>
      {problem && <p role="alert" className="text-ui text-red-600">{problem}</p>}
      {teams.length === 0 && <p className="text-ui text-lira-muted">No teams yet. Make one, add people to it, then give it access to a space, project, roadmap or dashboard.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {teams.map(t => <TeamCard key={`${t.id}:${t.memberIds.join(',')}`} org={org} team={t} members={members} reload={reload} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

function TeamCard({ org, team, members, reload, onOpen }: { org: string; team: Team; members: Member[]; reload: () => void; onOpen?: (teamId: string) => void }) {
  const [chosen, setChosen] = useState(() => new Set(team.memberIds));
  const [problem, setProblem] = useState('');
  const changed = chosen.size !== team.memberIds.length || team.memberIds.some(id => !chosen.has(id));

  const toggle = (id: string) => setChosen(prev => { const next = new Set(prev); if (!next.delete(id)) next.add(id); return next; });
  const save = async () => { setProblem(''); const r = await setTeamMembers(org, team.id, [...chosen]); if (r.ok) reload(); else setProblem(r.message); };
  const remove = async () => {
    if (await confirmDialog({ title: `Delete ${team.name}?`, message: 'The people stay in the organisation. Access given to this team is removed.', confirmLabel: 'Delete', tone: 'danger' })) {
      const r = await deleteTeam(org, team.id); if (r.ok) reload(); else setProblem(r.message);
    }
  };

  return (
    <section aria-label={team.name} className="border border-lira-border rounded-lg p-3 space-y-2">
      <div className="flex items-center"><h3 className="flex-1 font-bold">{onOpen ? <button type="button" onClick={() => onOpen(team.id)} className="underline text-left">{team.name}</button> : team.name}</h3><span className="text-ui text-lira-muted">{chosen.size} {chosen.size === 1 ? 'person' : 'people'}</span></div>
      <ul className="max-h-48 overflow-auto space-y-1">
        {members.map(m => (
          <li key={m.userId}><label className="flex items-center gap-2 text-ui"><input type="checkbox" checked={chosen.has(m.userId)} onChange={() => toggle(m.userId)} />{m.name} <span className="text-lira-muted">{m.email}</span></label></li>
        ))}
      </ul>
      {problem && <p role="alert" className="text-ui text-red-600">{problem}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={!changed} onClick={() => { void save(); }} className={BUTTON}>Save people</button>
        <button type="button" onClick={() => { void remove(); }} className="rounded px-3 py-1.5 text-ui border border-lira-border hover:bg-red-50 text-red-600">Delete team</button>
      </div>
    </section>
  );
}
