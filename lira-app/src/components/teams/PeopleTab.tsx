import { useState } from 'react';
import { invite, removeMember, revokeInvitation, updateMember, inviteLink, type AssignableRole, type CreatedInvitation, type Invitation, type Level, type Member, type Shares, type Team } from '../../services/accessApi';
import { useSpaceChoices } from '../../hooks/useSpaceChoices';
import { confirmDialog } from '../common/dialogStore';
import { BUTTON, FIELD, LEVELS, ROLES } from './teamsUi';

const SHARE_SWITCHES: readonly [keyof Shares, string][] = [['projects', 'Linked projects'], ['roadmaps', 'Linked roadmaps'], ['dashboards', 'Dashboards of this space only'], ['sprints', 'Sprints']];
const QUIET = 'rounded px-2 py-1 text-ui border border-lira-border text-lira-text hover:bg-gray-50';

interface Props { org: string; role: string; members: Member[]; teams: Team[]; invitations: Invitation[]; reload: () => void }

/** Who is in the organisation, and who has been invited. The owner changes roles; the Owner and permitted Admins invite and remove. */
export function PeopleTab({ org, role, members, teams, invitations, reload }: Props) {
  const isOwner = role === 'owner';
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AssignableRole>('member');
  const [teamId, setTeamId] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [level, setLevel] = useState<Level>('edit');
  const [shares, setShares] = useState<Shares>({ projects: true, roadmaps: true, dashboards: true, sprints: true });
  const spaces = useSpaceChoices(org);
  const roles = spaceId ? ROLES.filter(r => r.value !== 'admin') : ROLES; // an Admin has every space already
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  const act = async (work: () => Promise<{ ok: boolean; message?: string }>) => {
    setProblem('');
    const r = await work();
    if (r.ok) reload(); else setProblem(r.message ?? 'Something went wrong.');
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setProblem(''); setCreated(null);
    const r = await invite(org, { email: email.trim(), role: inviteRole, ...(teamId ? { teamId } : {}), ...(spaceId ? { spaceId: Number(spaceId), level, shares } : {}) });
    setBusy(false);
    if (!r.ok) { setProblem(r.fields?.email ?? r.message); return; }
    setCreated(r.data); setEmail(''); reload();
  };

  const remove = async (m: Member) => {
    if (await confirmDialog({ title: `Remove ${m.name}?`, message: 'They lose all access to this organisation. Their account is not deleted.', confirmLabel: 'Remove', tone: 'danger' })) await act(() => removeMember(org, m.userId));
  };

  return (
    <div className="space-y-6">
      <form onSubmit={e => { void send(e); }} className="flex flex-wrap items-end gap-2" aria-label="Invite someone">
        <label className="flex flex-col gap-1 text-ui">Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={`${FIELD} w-64`} /></label>
        <label className="flex flex-col gap-1 text-ui">Role
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value as AssignableRole)} className={FIELD}>{roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1 text-ui">Space (optional)
          <select value={spaceId} onChange={e => { setSpaceId(e.target.value); if (e.target.value && inviteRole === 'admin') setInviteRole('member'); }} className={FIELD}>
            <option value="">Whole organisation</option>{spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        {spaceId && (
          <label className="flex flex-col gap-1 text-ui">Access to the space
            <select value={level} onChange={e => setLevel(e.target.value as Level)} className={FIELD}>{LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select>
          </label>
        )}
        {spaceId && (
          <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ui w-full border border-lira-border rounded px-3 py-2">
            <legend className="px-1 text-lira-muted">Besides its tickets and comments, they also see</legend>
            {SHARE_SWITCHES.map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5"><input type="checkbox" checked={shares[key]} onChange={e => setShares({ ...shares, [key]: e.target.checked })} />{label}</label>
            ))}
          </fieldset>
        )}
        <label className="flex flex-col gap-1 text-ui">Team (optional)
          <select value={teamId} onChange={e => setTeamId(e.target.value)} className={FIELD}><option value="">No team</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </label>
        <button type="submit" disabled={busy} className={BUTTON}>{busy ? 'Inviting' : 'Invite'}</button>
      </form>
      <p className="text-ui text-lira-muted -mt-4">{ROLES.find(r => r.value === inviteRole)?.help}.</p>

      {problem && <p role="alert" className="text-ui text-red-600">{problem}</p>}
      {created && (
        <div role="status" className="border border-lira-border rounded-lg p-3 text-ui space-y-1.5">
          {created.emailed
            ? <p>An invitation email was sent to <strong>{created.email}</strong>.</p>
            : <p>Email is not connected yet, so nothing was sent. Copy this link and send it to <strong>{created.email}</strong> yourself. It works once, for that address, and shows only now.</p>}
          {!created.emailed && <input readOnly aria-label="Invitation link" value={inviteLink(created.token, window.location.origin)} onFocus={e => e.currentTarget.select()} className={`${FIELD} w-full`} />}
        </div>
      )}

      {invitations.length > 0 && (
        <section aria-label="Pending invitations">
          <h3 className="text-sm font-bold mb-2">Waiting to join</h3>
          <ul className="divide-y divide-lira-border border border-lira-border rounded-lg">
            {invitations.map(i => (
              <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-ui">
                <span className="flex-1">{i.email}</span>
                <span className="text-lira-muted capitalize">{i.role}{i.spaceId !== null && ` · ${spaces.find(s => s.id === i.spaceId)?.name ?? 'a space'} (${i.level})`}</span>
                <button type="button" onClick={() => { void act(() => revokeInvitation(org, i.id)); }} className={QUIET}>Cancel invitation</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="People">
        <h3 className="text-sm font-bold mb-2">People ({members.length})</h3>
        <ul className="divide-y divide-lira-border border border-lira-border rounded-lg">
          {members.map(m => (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 px-3 py-2 text-ui">
              <span className="flex-1 min-w-40"><strong>{m.name}</strong><br /><span className="text-lira-muted">{m.email}</span></span>
              {m.role === 'owner' ? <span className="font-bold">Owner</span> : isOwner ? (
                <select aria-label={`Role of ${m.name}`} value={m.role} onChange={e => { void act(() => updateMember(org, m.userId, { role: e.target.value as AssignableRole })); }} className={FIELD}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              ) : <span className="capitalize">{m.role}</span>}
              {isOwner && m.role === 'admin' && (
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={m.manageAccess} onChange={e => { void act(() => updateMember(org, m.userId, { manageAccess: e.target.checked })); }} /> Can manage people and access</label>
              )}
              {m.role !== 'owner' && <button type="button" onClick={() => { void remove(m); }} className={QUIET}>Remove</button>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
