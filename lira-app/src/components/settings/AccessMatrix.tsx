import { useEffect, useState } from 'react';
import { listAllGrants, revokeGrant, setGrant, type Grant, type Level, type Member, type ObjectKind, type Team } from '../../services/accessApi';
import { useObjectChoices } from '../../hooks/useObjectChoices';
import { cellFor, KIND_LABEL, LEVEL_LABEL, type Subject } from '../../utils/accessRows';
import { FIELD } from '../teams/teamsUi';

const KINDS = Object.keys(KIND_LABEL) as ObjectKind[];
const NONE = 'none';

interface RowDef { key: string; label: string; note: string; subject: Subject | null }

/** Every person and team against every thing of one kind, with the level in each cell. A cell is changed in place; access that comes through a team is shown beside it. */
export function AccessMatrix({ org, members, teams }: { org: string; members: Member[]; teams: Team[] }) {
  const [kind, setKind] = useState<ObjectKind>('space');
  const choices = useObjectChoices(org);
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [reloads, setReloads] = useState(0);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    let current = true;
    void listAllGrants(org).then(r => { if (current) setGrants(r.ok ? r.data : []); });
    return () => { current = false; };
  }, [org, reloads]);

  if (!choices || !grants) return <p role="status" className="text-ui text-lira-muted">Loading access…</p>;
  const things = choices[kind];
  const rows: RowDef[] = [
    ...teams.map((t): RowDef => ({ key: `t:${t.id}`, label: t.name, note: `Team, ${t.memberIds.length} ${t.memberIds.length === 1 ? 'person' : 'people'}`, subject: { type: 'team', id: t.id } })),
    ...members.map((m): RowDef => ({ key: `u:${m.userId}`, label: m.name, note: m.role, subject: m.role === 'owner' || m.role === 'admin' ? null : { type: 'user', id: m.userId, teamIds: m.teamIds } })),
  ];

  const change = async (subject: Subject, objectId: string, current: Grant | null, value: string) => {
    setProblem('');
    const r = value === NONE
      ? (current ? await revokeGrant(org, current.id) : { ok: true as const })
      : await setGrant(org, { subjectType: subject.type, subjectId: subject.id, kind, objectId, level: value as Level });
    if (r.ok) setReloads(n => n + 1); else setProblem(r.message);
  };

  return (
    <section aria-label="Who can reach what" className="space-y-3">
      <div role="group" aria-label="Kind of thing" className="flex flex-wrap gap-1.5">
        {KINDS.map(k => (
          <button key={k} type="button" aria-pressed={k === kind} onClick={() => setKind(k)}
            className={`rounded-lg border px-3 py-1 text-ui ${k === kind ? 'bg-lira-blue text-lira-on-blue border-lira-blue font-bold' : 'bg-white border-lira-border text-lira-text'}`}>{KIND_LABEL[k]}s</button>
        ))}
      </div>
      {problem && <p role="alert" className="text-ui text-red-600">{problem}</p>}
      {things.length === 0 ? <p className="text-ui text-lira-muted">There is no {KIND_LABEL[kind].toLowerCase()} to share yet.</p> : (
        <div className="overflow-x-auto bg-white border border-lira-border rounded-xl">
          <table className="w-full text-ui border-separate border-spacing-0">
            <thead><tr><th scope="col" className="sticky left-0 bg-white text-left p-2 text-lira-muted font-bold">Person or team</th>{things.map(t => <th key={t.id} scope="col" className="p-2 text-center text-lira-muted font-bold whitespace-nowrap">{t.name}</th>)}</tr></thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key}>
                  <th scope="row" className="sticky left-0 bg-white text-left p-2 border-t border-lira-border font-normal whitespace-nowrap"><span className="font-bold">{row.label}</span> <span className="text-2xs text-lira-muted capitalize">{row.note}</span></th>
                  {row.subject === null
                    ? <td colSpan={things.length} className="p-2 border-t border-lira-border text-lira-muted text-center">Reaches everything</td>
                    : things.map(t => {
                      const subject = row.subject!;
                      const cell = cellFor(subject, kind, t.id, grants, teams);
                      return (
                        <td key={t.id} className="p-1.5 border-t border-lira-border text-center">
                          <select aria-label={`${row.label} on ${t.name}`} value={cell.direct?.level ?? NONE} onChange={e => { void change(subject, t.id, cell.direct, e.target.value); }} className={FIELD}>
                            <option value={NONE}>None</option>{(['view', 'edit', 'manage'] as const).map(l => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
                          </select>
                          {cell.inherited && <span className="block text-3xs text-lira-muted">{LEVEL_LABEL[cell.inherited.level]} via {cell.inherited.via}</span>}
                        </td>
                      );
                    })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-2xs text-lira-muted">The Owner and Admins always reach everything. A Viewer can only ever view and a Guest can never manage, whatever is set here.</p>
    </section>
  );
}
