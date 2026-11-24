import { useEffect, useState } from 'react';
import { listGrants, revokeGrant, setGrant, type Grant, type Level, type Member, type ObjectKind, type Team } from '../../services/accessApi';
import { listObjects, listSpaces } from '../../services/workspaceApi';
import { BUTTON, FIELD, LEVELS } from './teamsUi';
import { SpaceSharesPanel } from './SpaceSharesPanel';

const KINDS: { value: ObjectKind; label: string }[] = [{ value: 'space', label: 'Space' }, { value: 'project', label: 'Project' }, { value: 'roadmap', label: 'Roadmap' }, { value: 'dashboard', label: 'Dashboard' }, { value: 'storybox', label: 'Story box' }, { value: 'mindmap', label: 'Mind map' }];
interface Choice { id: string; name: string }

/** Who may do what with one space, project, roadmap or dashboard. Owner and Admin always have everything and are not listed. */
export function AccessTab({ org, members, teams }: { org: string; members: Member[]; teams: Team[] }) {
  const [kind, setKind] = useState<ObjectKind>('space');
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [objectId, setObjectId] = useState('');
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [reloads, setReloads] = useState(0);
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState<Level>('view');
  const [problem, setProblem] = useState('');

  useEffect(() => {
    let current = true;
    const load = kind === 'space'
      ? listSpaces(org).then(r => (r.ok ? r.data.map(s => ({ id: String(s.id), name: `${s.name} (${s.key})` })) : null))
      : listObjects(org, kind as Exclude<ObjectKind, 'space'>).then(r => (r.ok ? r.data.map(o => ({ id: o.id, name: typeof o.doc.name === 'string' && o.doc.name ? o.doc.name : o.id })) : null));
    void load.then(list => { if (current) { setChoices(list ?? []); setObjectId(list?.[0]?.id ?? ''); } });
    return () => { current = false; };
  }, [org, kind]);

  useEffect(() => {
    if (!objectId) return;
    let current = true;
    void listGrants(org, kind, objectId).then(r => { if (current) setGrants(r.ok ? r.data : []); });
    return () => { current = false; };
  }, [org, kind, objectId, reloads]);

  const nameOf = (g: Grant) => (g.subjectType === 'team' ? `Team: ${teams.find(t => t.id === g.subjectId)?.name ?? 'removed'}` : members.find(m => m.userId === g.subjectId)?.name ?? 'Removed person');
  const change = async (work: Promise<{ ok: boolean; message?: string }>) => { setProblem(''); const r = await work; if (r.ok) setReloads(n => n + 1); else setProblem(r.message ?? 'Something went wrong.'); };
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const [subjectType, subjectId] = subject.split(':') as ['user' | 'team', string];
    void change(setGrant(org, { subjectType, subjectId, kind, objectId, level }));
  };
  const visible = objectId ? grants : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-ui">What<select aria-label="Kind" value={kind} onChange={e => { setChoices(null); setGrants(null); setKind(e.target.value as ObjectKind); }} className={FIELD}>{KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-ui">Which<select aria-label="Object" value={objectId} onChange={e => { setGrants(null); setObjectId(e.target.value); }} className={`${FIELD} min-w-56`} disabled={!choices?.length}>
          {(choices ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></label>
      </div>
      {choices && choices.length === 0 && <p className="text-ui text-lira-muted">There is nothing of this kind yet.</p>}
      {kind === 'space' && objectId && <SpaceSharesPanel org={org} spaceId={objectId} />}

      {objectId && (
        <>
          <p className="text-ui text-lira-muted">The Owner and Admins can always do everything. A Viewer can only ever view, and a Guest can never manage, whatever is given here.</p>
          {problem && <p role="alert" className="text-ui text-red-600">{problem}</p>}
          {visible === null ? <p role="status" className="text-ui text-lira-muted">Loading</p> : visible.length === 0 ? <p className="text-ui text-lira-muted">Nobody has been given access yet.</p> : (
            <ul className="divide-y divide-lira-border border border-lira-border rounded-lg" aria-label="Who has access">
              {visible.map(g => (
                <li key={g.id} className="flex items-center gap-3 px-3 py-2 text-ui">
                  <span className="flex-1">{nameOf(g)}</span>
                  <select aria-label={`Level of ${nameOf(g)}`} value={g.level} onChange={e => { void change(setGrant(org, { ...g, level: e.target.value as Level })); }} className={FIELD}>{LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select>
                  <button type="button" onClick={() => { void change(revokeGrant(org, g.id)); }} className="rounded px-2 py-1 border border-lira-border hover:bg-gray-50">Remove access</button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={add} className="flex flex-wrap items-end gap-2" aria-label="Give access">
            <label className="flex flex-col gap-1 text-ui">Person or team
              <select required value={subject} onChange={e => setSubject(e.target.value)} className={`${FIELD} min-w-56`}>
                <option value="">Choose</option>
                <optgroup label="Teams">{teams.map(t => <option key={t.id} value={`team:${t.id}`}>{t.name}</option>)}</optgroup>
                <optgroup label="People">{members.filter(m => m.role !== 'owner' && m.role !== 'admin').map(m => <option key={m.userId} value={`user:${m.userId}`}>{m.name}</option>)}</optgroup>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-ui">Level<select value={level} onChange={e => setLevel(e.target.value as Level)} className={FIELD}>{LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select></label>
            <button type="submit" className={BUTTON}>Give access</button>
          </form>
          <p className="text-ui text-lira-muted">{LEVELS.find(l => l.value === level)?.help}.</p>
        </>
      )}
    </div>
  );
}
