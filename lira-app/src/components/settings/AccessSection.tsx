import { useEffect, useState } from 'react';
import { listAllGrants, revokeGrant, setGrant, type Grant, type Level, type ObjectKind, type Team } from '../../services/accessApi';
import { useObjectChoices } from '../../hooks/useObjectChoices';
import { accessFor, KIND_LABEL, objectName, type ObjectChoices, type Subject } from '../../utils/accessRows';
import { BUTTON, FIELD, LEVELS } from '../teams/teamsUi';
import { LevelPill } from './LevelPill';

const KINDS = Object.keys(KIND_LABEL) as ObjectKind[];

interface Props { org: string; subject: Subject; teams: Team[]; /** Owner and Admins already reach everything; no grant changes that. */ everything: boolean }

function AddAccess({ org, subject, choices, done }: { org: string; subject: Subject; choices: ObjectChoices; done: () => void }) {
  const [kind, setKind] = useState<ObjectKind>('space');
  const [objectId, setObjectId] = useState('');
  const [level, setLevel] = useState<Level>('view');
  const [problem, setProblem] = useState('');
  const options = choices[kind];
  const chosen = options.some(o => o.id === objectId) ? objectId : options[0]?.id ?? '';
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setProblem('');
    const r = await setGrant(org, { subjectType: subject.type, subjectId: subject.id, kind, objectId: chosen, level });
    if (r.ok) done(); else setProblem(r.message);
  };
  return (
    <form onSubmit={e => { void add(e); }} aria-label="Give access" className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-ui">What<select aria-label="Kind" value={kind} onChange={e => setKind(e.target.value as ObjectKind)} className={FIELD}>{KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-ui">Which<select aria-label="Object" value={chosen} onChange={e => setObjectId(e.target.value)} className={`${FIELD} min-w-56`} disabled={options.length === 0}>{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-ui">Level<select aria-label="Level" value={level} onChange={e => setLevel(e.target.value as Level)} className={FIELD}>{LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select></label>
      <button type="submit" className={BUTTON} disabled={!chosen}>Give access</button>
      {problem && <p role="alert" className="text-ui text-red-600 basis-full">{problem}</p>}
    </form>
  );
}

/** What one person or team can reach, as a list that can be changed: the level, taking it away, and giving more. Access that comes through a team is changed on the team. */
export function AccessSection({ org, subject, teams, everything }: Props) {
  const choices = useObjectChoices(org);
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [reloads, setReloads] = useState(0);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    let current = true;
    void listAllGrants(org).then(r => { if (current) setGrants(r.ok ? r.data : []); });
    return () => { current = false; };
  }, [org, reloads]);

  const reload = () => setReloads(n => n + 1);
  const change = async (work: Promise<{ ok: boolean; message?: string }>) => { setProblem(''); const r = await work; if (r.ok) reload(); else setProblem(r.message ?? 'Something went wrong.'); };

  if (everything) return <p className="text-ui text-lira-muted">The Owner and Admins can always reach and do everything in the organisation, so nothing is listed here.</p>;
  if (!grants || !choices) return <p role="status" className="text-ui text-lira-muted">Loading access…</p>;
  const rows = accessFor(subject, grants, teams);

  return (
    <section aria-label="Access" className="space-y-3">
      <h2 className="text-base font-bold text-lira-text">Access</h2>
      {problem && <p role="alert" className="text-ui text-red-600">{problem}</p>}
      {rows.length === 0 ? <p className="text-ui text-lira-muted">Nothing has been shared yet.</p> : KINDS.filter(k => rows.some(r => r.grant.kind === k)).map(k => (
        <div key={k} className="space-y-1.5">
          <h3 className="text-3xs font-bold uppercase tracking-wide text-lira-muted">{KIND_LABEL[k]}s</h3>
          <ul className="space-y-1.5">
            {rows.filter(r => r.grant.kind === k).map(({ grant: g, via }) => {
              const name = objectName(choices, g.kind, g.objectId);
              return (
                <li key={g.id} className="flex flex-wrap items-center gap-2 border border-lira-border rounded-lg px-3 py-2 text-ui">
                  <span className="flex-1 min-w-32"><span className="font-semibold">{name}</span> <span className="text-lira-muted text-2xs">{via ? `Team ${via}` : 'Directly'}</span></span>
                  {via ? <LevelPill level={g.level} /> : (
                    <select aria-label={`Level for ${name}`} value={g.level} onChange={e => { void change(setGrant(org, { subjectType: g.subjectType, subjectId: g.subjectId, kind: g.kind, objectId: g.objectId, level: e.target.value as Level })); }} className={FIELD}>
                      {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  )}
                  {!via && <button type="button" onClick={() => { void change(revokeGrant(org, g.id)); }} className="underline text-ui">Remove</button>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <AddAccess org={org} subject={subject} choices={choices} done={reload} />
    </section>
  );
}
