import { useState } from 'react';
import { db } from '../../db/db';
import type { Issue } from '../../types/issue';
import type { Space } from '../../types/space';
import { currentTime } from '../../utils/clock';
import { scopeLabel, statsOf, suggestedPoints, ticketsInScope, votesFor, type StoryBox } from '../../utils/storybox';
import { confirmDialog } from '../common/dialogStore';
import { FIELD } from '../teams/teamsUi';
import { useBoxVotes } from './useBoxVotes';

interface Props { box: StoryBox; issues: Issue[]; spaces: Space[]; canManage: boolean; onChange: (box: StoryBox) => void; onDelete: () => void }

/** One story box: its tickets with everyone's points, your own buttons while it is open, and for those who run it the closing and the final points. */
export function StoryBoxBoard({ box, issues, spaces, canManage, onChange, onDelete }: Props) {
  const { votes, vote, problem } = useBoxVotes(box, localVotes => onChange({ ...box, localVotes }));
  const [spaceFilter, setSpaceFilter] = useState('all');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [text, setText] = useState('');
  const open = box.status === 'open';
  const spaceName = (id: number) => spaces.find(s => s.id === id)?.key ?? '';
  const rows = ticketsInScope(issues, box.scope).filter(i =>
    (spaceFilter === 'all' || String(i.spaceId) === spaceFilter) && (!onlyOpen || i.storyPoints === undefined) && `${i.key} ${i.title}`.toLowerCase().includes(text.toLowerCase()));
  const setPoints = (issue: Issue, points: number | undefined) => db.issues.update(issue.id!, { storyPoints: points, updatedAt: currentTime() });
  const estimated = rows.filter(i => i.storyPoints !== undefined).length;
  const total = rows.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);

  async function applyAll() {
    const todo = rows.map(i => ({ i, p: suggestedPoints(votesFor(votes, i.id!), box.scale) })).filter(x => x.p !== null && x.i.storyPoints === undefined);
    if (todo.length === 0 || !(await confirmDialog({ title: 'Put the suggested points on tickets?', message: `${todo.length} ticket(s) without points get the point value nearest to the median of the votes.`, confirmLabel: 'Apply' }))) return;
    for (const { i, p } of todo) await setPoints(i, p!);
  }
  const close = () => onChange(open ? { ...box, status: 'closed', closedAt: currentTime().toISOString() } : { ...box, status: 'open', closedAt: undefined });

  return (
    <section aria-label={box.name} className="flex-1 min-w-0 space-y-3 text-ui">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <h2 className="text-lg font-bold">{box.name} <span className={`ml-2 text-xs rounded px-2 py-0.5 border ${open ? 'border-lira-blue text-lira-text' : 'border-lira-border text-lira-muted'}`}>{open ? 'Open' : 'Closed'}</span></h2>
          <p className="text-lira-muted">{scopeLabel(box.scope, spaces)}. Made by {box.createdBy}. {estimated} of {rows.length} shown have points, {total} points in all.</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {open && <button type="button" onClick={() => { void applyAll(); }} className="rounded px-3 py-1.5 border border-lira-border">Apply suggested points</button>}
            <button type="button" onClick={close} className="rounded px-3 py-1.5 border border-lira-border">{open ? 'Close the box' : 'Reopen'}</button>
            <button type="button" onClick={onDelete} className="rounded px-3 py-1.5 border border-lira-border">Delete</button>
          </div>
        )}
      </header>
      {!open && <p role="status" className="text-lira-muted">This box is closed: points can no longer be given. It stays here as history.</p>}
      {problem && <p role="alert" className="text-red-600">{problem}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" aria-label="Search tickets" placeholder="Search tickets" value={text} onChange={e => setText(e.target.value)} className={`${FIELD} w-48`} />
        {box.scope.type === 'sprint' && (
          <select aria-label="Space" value={spaceFilter} onChange={e => setSpaceFilter(e.target.value)} className={FIELD}>
            <option value="all">All spaces</option>{spaces.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>
        )}
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={onlyOpen} onChange={e => setOnlyOpen(e.target.checked)} />Without points only</label>
      </div>
      {rows.length === 0 ? <p className="text-lira-muted">No tickets match.</p> : (
        <div className="overflow-x-auto border border-lira-border rounded-lg">
          <table className="w-full text-left">
            <thead className="text-lira-muted"><tr><th className="p-2">Ticket</th><th className="p-2">Space</th><th className="p-2">Points</th><th className="p-2">Your points</th><th className="p-2">Votes</th><th className="p-2">Suggested</th></tr></thead>
            <tbody>
              {rows.map(i => {
                const mine = votes.find(x => x.ticketId === i.id && (x.userId === 'me' || x.name === 'You'));
                const list = votesFor(votes, i.id!); const stats = statsOf(list); const hint = suggestedPoints(list, box.scale);
                return (
                  <tr key={i.id} className="border-t border-lira-border align-top">
                    <td className="p-2"><strong>{i.key}</strong> {i.title}</td>
                    <td className="p-2">{spaceName(i.spaceId)}</td>
                    <td className="p-2">{canManage
                      ? <select aria-label={`Points of ${i.key}`} value={i.storyPoints ?? ''} onChange={e => { void setPoints(i, e.target.value === '' ? undefined : Number(e.target.value)); }} className={FIELD}><option value="">None</option>{box.scale.map(p => <option key={p} value={p}>{p}</option>)}</select>
                      : i.storyPoints ?? 'None'}</td>
                    <td className="p-2">
                      <span className="flex flex-wrap gap-1" role="group" aria-label={`Your points for ${i.key}`}>
                        {box.scale.map(p => <button key={p} type="button" disabled={!open} aria-pressed={mine?.points === p} onClick={() => { void vote(i.id!, mine?.points === p ? null : p); }}
                          className={`min-w-7 h-7 rounded border text-xs ${mine?.points === p ? 'border-lira-blue bg-lira-blue-light font-bold' : 'border-lira-border'} disabled:opacity-50`}>{p}</button>)}
                      </span>
                    </td>
                    <td className="p-2">{stats.count === 0 ? 'No votes' : <><span>{stats.count} votes, average {stats.average}</span><br /><span className="text-lira-muted">{list.map(v => `${v.name} ${v.points}`).join(', ')}</span></>}</td>
                    <td className="p-2">{hint ?? ''}{canManage && hint !== null && i.storyPoints !== hint && open && <button type="button" aria-label={`Use ${hint} for ${i.key}`} onClick={() => { void setPoints(i, hint); }} className="ml-2 rounded px-2 py-0.5 border border-lira-border">Use</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
