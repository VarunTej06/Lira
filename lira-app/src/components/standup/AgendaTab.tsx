import { Check, Copy, AlertTriangle, Clock, Ban, Sparkles, ListChecks } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import type { Issue } from '../../types/issue';
import { FIELD, LABEL, Section, TicketRow } from './parts';
import type { StandupState } from './useStandup';

const SEVERITY_TONE = { high: 'bg-red-100 text-red-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-gray-100 text-gray-600' };
const blockedNote = (blockedBy: Issue[]) => (blockedBy.length ? `blocked by ${blockedBy.map(x => x.key).join(', ')}` : 'marked Blocked');

/** Today's agenda, built from the live tickets, by status or by person. */
export function AgendaTab(s: StandupState) {
  const { agenda, people, view, setView, copied, copyAgenda, notes, changeNotes, openIssue } = s;
  const tiles = [
    { label: 'Need an update', value: agenda.needsUpdate.length, color: 'text-red-600' },
    { label: 'In progress', value: agenda.inProgress.length, color: 'text-lira-blue' },
    { label: 'Blocked', value: agenda.blocked.length, color: 'text-amber-600' },
    { label: 'To do / backlog', value: agenda.upNext.length + agenda.backlog.length, color: 'text-lira-text' },
    { label: 'Done · 24h', value: agenda.doneRecently.length, color: 'text-emerald-600' },
  ];
  const rows = (list: Issue[], limit = list.length) => list.slice(0, limit).map(i => <TicketRow key={i.id} issue={i} onOpen={openIssue} />);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {tiles.map(t => (
          <div key={t.label} className="border border-lira-border rounded-xl px-3 py-2 bg-white">
            <div className={`text-xl font-semibold ${t.color}`}>{t.value}</div>
            <div className="text-[11px] text-lira-muted">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-xl border border-lira-border overflow-hidden text-xs">
          {(['status', 'person'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 cursor-pointer ${view === v ? 'bg-lira-blue text-white' : 'bg-white text-lira-muted hover:text-lira-text'}`}>
              {v === 'status' ? 'By status' : 'By person'}
            </button>
          ))}
        </div>
        <button onClick={copyAgenda} className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-lira-border bg-white hover:bg-gray-50 text-lira-text cursor-pointer">
          {copied ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy call notes</>}
        </button>
      </div>

      {view === 'status' ? (
        <div className="space-y-3">
          <Section title="Needs an update" icon={<AlertTriangle className="w-3.5 h-3.5 text-red-500" />} count={agenda.needsUpdate.length} empty="Everything is up to date">
            {agenda.needsUpdate.map(n => <TicketRow key={n.issue.id} issue={n.issue} note={n.reason} tone={SEVERITY_TONE[n.severity]} onOpen={openIssue} />)}
          </Section>
          <Section title="Blocked" icon={<Ban className="w-3.5 h-3.5 text-amber-500" />} count={agenda.blocked.length} empty="Nothing is blocked.">
            {agenda.blocked.map(b => <TicketRow key={b.issue.id} issue={b.issue} note={blockedNote(b.blockedBy)} tone="bg-amber-100 text-amber-700" onOpen={openIssue} />)}
          </Section>
          <Section title="In progress" icon={<Clock className="w-3.5 h-3.5 text-lira-blue" />} count={agenda.inProgress.length} empty="Nothing in progress.">{rows(agenda.inProgress)}</Section>
          <Section title="Done in the last 24 hours" icon={<Sparkles className="w-3.5 h-3.5 text-emerald-500" />} count={agenda.doneRecently.length} empty="Nothing finished yet.">{rows(agenda.doneRecently)}</Section>
          <Section title="Up next · To do" icon={<ListChecks className="w-3.5 h-3.5 text-lira-muted" />} count={agenda.upNext.length} empty="Nothing waiting.">{rows(agenda.upNext, 8)}</Section>
          <Section title="Backlog (top)" icon={<ListChecks className="w-3.5 h-3.5 text-lira-muted" />} count={agenda.backlog.length} empty="Backlog is empty.">{rows(agenda.backlog, 6)}</Section>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {people.length === 0 && <p className="text-sm text-lira-muted">No assigned tickets in this scope.</p>}
          {people.map(p => (
            <div key={p.key} className="border border-lira-border rounded-2xl bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-lira-border">
                <Avatar initials={p.key === '—' ? '?' : p.key} size="sm" />
                <span className="text-sm font-semibold text-lira-text">{p.name}</span>
                {p.stale.length > 0 && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700">{p.stale.length} need update</span>}
              </div>
              {([['Yesterday', p.done], ['Today', p.doing], ['Next', p.next]] as const).map(([label, list]) => (
                <div key={label} className="px-3 py-1.5 border-b border-lira-border last:border-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-lira-muted mb-0.5">{label}</div>
                  {list.length === 0 ? <div className="text-xs text-lira-muted">—</div> : list.map(i => (
                    <button key={i.id} onClick={() => openIssue(i)} className="block w-full text-left text-xs text-lira-text truncate hover:text-lira-blue cursor-pointer py-0.5">
                      <span className="font-mono text-lira-muted mr-1.5">{i.key}</span>{i.title}
                    </button>
                  ))}
                </div>
              ))}
              {p.blocked.length > 0 && (
                <div className="px-3 py-1.5 bg-amber-50/60">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-0.5">Blockers</div>
                  {p.blocked.map(b => <div key={b.issue.id} className="text-xs text-amber-800 truncate">{b.issue.key}{b.blockedBy.length ? ` ← ${b.blockedBy.map(x => x.key).join(', ')}` : ' (blocked)'}</div>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div>
        <label className={LABEL}>Notes & action items (saved for today)</label>
        <textarea rows={3} value={notes} onChange={e => changeNotes(e.target.value)} placeholder="Decisions, blockers to chase, parking lot…" className={FIELD} />
      </div>
    </>
  );
}
