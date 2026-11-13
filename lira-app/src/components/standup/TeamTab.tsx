import { Plus, Trash2, UserRound } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { FIELD, LABEL } from './parts';
import { EMAIL_RE, type StandupState } from './useStandup';

const TEAM_NOTE = {
  sprint: 'The sprint team is everyone with a ticket in it, plus anyone added to its space.',
  project: 'The project team is everyone with a ticket in it, plus anyone added to the project or its space.',
  space: 'The space team is everyone with a ticket in it, plus anyone added here.',
};

/** Who gets the invite: the people on the tickets, plus anyone added by hand. */
export function TeamTab(s: StandupState) {
  const { scope, members, extras, selected, newName, setNewName, newEmail, setNewEmail } = s;
  return (
    <>
      <div className="rounded-2xl border border-lira-border bg-gray-50 px-4 py-3 text-xs text-lira-muted space-y-1">
        <p>
          <strong className="text-lira-text">Invites go to the team assigned to this {scope.type}.</strong>{' '}
          {TEAM_NOTE[scope.type]}
        </p>
        <p>Dedicated Teams (named groups per space and project) are coming in a later version — they will replace this automatic list. Emails are remembered for every space, project and sprint.</p>
      </div>
      <section className="border border-lira-border rounded-2xl overflow-hidden bg-white">
        {members.length === 0 && <p className="px-4 py-6 text-sm text-lira-muted">No assignees yet — add people below.</p>}
        {members.map(m => (
          <div key={m.key} className="flex items-center gap-3 px-3 py-2 border-b border-lira-border last:border-0">
            <input type="checkbox" checked={selected.has(m.key)} onChange={() => s.toggleMember(m.key)} className="cursor-pointer" aria-label={`Invite ${m.name}`} />
            <Avatar initials={m.key.length <= 3 ? m.key : m.name.slice(0, 2).toUpperCase()} size="sm" />
            <input className="text-sm border border-transparent hover:border-lira-border focus:border-lira-blue rounded-lg px-2 py-1 bg-transparent text-lira-text w-40 outline-none" value={m.name} onChange={e => s.updateMember(m, { name: e.target.value })} />
            <input
              className={`flex-1 text-sm border rounded-lg px-2 py-1 bg-white text-lira-text outline-none focus:border-lira-blue ${m.email && !EMAIL_RE.test(m.email) ? 'border-red-300' : 'border-lira-border'}`}
              placeholder="email@company.com" value={m.email} onChange={e => s.updateMember(m, { email: e.target.value })}
            />
            {extras.includes(m.key) && <button onClick={() => s.removeExtra(m.key)} className="p-1.5 rounded-lg text-lira-muted hover:text-red-600 hover:bg-red-50 cursor-pointer" title="Remove from this team"><Trash2 className="w-3.5 h-3.5" /></button>}
          </div>
        ))}
      </section>
      <div className="flex gap-2 items-end">
        <div className="w-44"><label className={LABEL}>Name</label><input className={FIELD} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Teammate" /></div>
        <div className="flex-1"><label className={LABEL}>Email</label><input className={FIELD} value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="name@company.com" onKeyDown={e => e.key === 'Enter' && s.addExtra()} /></div>
        <button onClick={s.addExtra} className="flex items-center gap-1 text-sm px-3 py-2 rounded-xl border border-lira-border bg-white hover:bg-gray-50 text-lira-text cursor-pointer"><Plus className="w-4 h-4" /> Add</button>
      </div>
      <p className="text-2xs text-lira-muted flex items-center gap-1"><UserRound className="w-3 h-3" /> Emails are stored only in this browser.</p>
    </>
  );
}
