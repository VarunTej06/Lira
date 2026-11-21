import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { myAccess } from '../../services/accessApi';
import { deleteStandup, googleStatus, isMeetingLink, listStandups, standupAudience, type Audience, type GoogleStatus, type Standup } from '../../services/standupsApi';
import { currentTimeMs } from '../../utils/clock';
import { formatDayDateTime } from '../../utils/dateUtils';
import { activeOrg } from '../../utils/hostedOrg';
import { nextOccurrence, repeatSummary } from '../../utils/standupSchedule';
import { CALL_KINDS, CALL_KIND_PLURAL, scopeLabel, type CallScopeType } from '../../utils/callScopes';
import { confirmDialog } from '../common/dialogStore';
import { Skeleton } from '../common/Skeleton';
import { BUTTON } from '../teams/teamsUi';
import { GooglePanel } from './GooglePanel';
import { StandupForm } from './StandupForm';
import { useCallScopeChoices } from './useCallScopeChoices';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; calls: Standup[]; admin: boolean; owner: boolean; audience: Audience | null; google: GoogleStatus | null };

const GOOGLE_RESULT: Record<string, string> = {
  connected: 'Google is connected.', refused: 'Google was not connected: the sign-in was cancelled or did not give permission.', failed: 'Google could not be connected. Try again.',
};

/**
 * Calls: stand-ups, project syncs, sprint calls and space calls in one place. Everyone sees the calls they are invited to and opens the
 * link; the Owner and Admins also schedule, change and delete them, and the Owner connects Google. A call is once, or a series. The call
 * itself runs in Google Meet or Microsoft Teams.
 */
export function StandupsPage() {
  const org = activeOrg();
  const [params] = useSearchParams();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [reloads, setReloads] = useState(0);
  const [form, setForm] = useState<{ editing: Standup | null } | null>(null);
  const [notice, setNotice] = useState(GOOGLE_RESULT[params.get('google') ?? ''] ?? '');
  const [problem, setProblem] = useState('');
  const [now] = useState(currentTimeMs);
  const [kind, setKind] = useState<CallScopeType | 'all'>('all');
  const choices = useCallScopeChoices();

  useEffect(() => {
    if (!org) return;
    let current = true;
    void (async () => {
      const [access, calls] = await Promise.all([myAccess(org), listStandups(org)]);
      if (!current) return;
      if (!access.ok) { setLoad({ state: 'error', message: access.message }); return; }
      if (!calls.ok) { setLoad({ state: 'error', message: calls.message }); return; }
      const owner = access.data.role === 'owner';
      const admin = owner || access.data.role === 'admin';
      const [audience, google] = admin ? await Promise.all([standupAudience(org), googleStatus(org)]) : [null, null];
      if (current) setLoad({ state: 'ready', calls: calls.data, admin, owner, audience: audience?.ok ? audience.data : null, google: google?.ok ? google.data : null });
    })();
    return () => { current = false; };
  }, [org, reloads]);

  const reload = () => setReloads(n => n + 1);
  const remove = async (call: Standup) => {
    if (!(await confirmDialog({ title: `Delete "${call.title}"?`, message: call.repeat === 'none' ? 'It disappears for everyone invited.' : 'The whole series disappears for everyone invited.', confirmLabel: 'Delete', tone: 'danger' }))) return;
    const r = await deleteStandup(org!, call.id);
    if (r.ok) reload(); else setProblem(r.message);
  };

  const timed = load.state === 'ready' ? load.calls.filter(c => kind === 'all' || c.scopeType === kind).map(c => ({ call: c, next: nextOccurrence(c, now) })) : [];
  const upcoming = timed.filter(t => t.next && !t.next.over).sort((a, b) => a.next!.at - b.next!.at);
  const past = timed.filter(t => !t.next || t.next.over).sort((a, b) => (b.next?.at ?? 0) - (a.next?.at ?? 0));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <header className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-lira-text">Calls</h1>
          <p className="text-ui text-lira-muted">Stand-ups, project syncs, sprint and space calls you are invited to, once or repeating. Open the link at the start time to join. They are also in the calendar.</p>
        </div>
        {load.state === 'ready' && load.admin && load.audience && !form && <button type="button" onClick={() => { setNotice(''); setForm({ editing: null }); }} className={BUTTON}>Schedule a call</button>}
      </header>

      {!org && <p role="alert" className="text-ui text-red-600">You are not signed in to an organisation.</p>}
      {org && load.state === 'loading' && <div role="status" aria-label="Loading stand-ups" className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>}
      {load.state === 'error' && <p role="alert" className="text-ui text-red-600">{load.message} <button type="button" onClick={() => { setLoad({ state: 'loading' }); reload(); }} className="underline">Try again</button></p>}
      {notice && <p role="status" className="text-ui">{notice}</p>}
      {problem && <p role="alert" className="text-ui text-red-600">{problem}</p>}

      {load.state === 'ready' && load.owner && load.google && <GooglePanel org={org!} status={load.google} reload={reload} />}

      {load.state === 'ready' && form && load.audience && (
        <StandupForm org={org!} audience={load.audience} editing={form.editing} scopeChoices={choices} onCancel={() => setForm(null)} onDone={message => { setForm(null); setNotice(message ?? ''); reload(); }} />
      )}

      {load.state === 'ready' && (
        <div role="group" aria-label="Kind of call" className="flex flex-wrap gap-2">
          {(['all', ...CALL_KINDS] as const).map(k => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`rounded-full px-3 py-1 text-ui border ${kind === k ? 'bg-lira-text text-lira-bg border-lira-text' : 'border-lira-border text-lira-text hover:bg-gray-50'}`}>{k === 'all' ? 'All calls' : CALL_KIND_PLURAL[k]}</button>
          ))}
        </div>
      )}

      {load.state === 'ready' && (
        <>
          <CallList title="Upcoming" items={upcoming} empty="No calls are scheduled for you." admin={load.admin} audience={load.audience} onEdit={c => { setNotice(''); setForm({ editing: c }); }} onDelete={c => { void remove(c); }} />
          {past.length > 0 && <CallList title="Earlier" items={past} empty="" admin={load.admin} audience={load.audience} muted onEdit={c => { setNotice(''); setForm({ editing: c }); }} onDelete={c => { void remove(c); }} />}
        </>
      )}
    </div>
  );
}

interface Item { call: Standup; next: { at: number; over: boolean } | null }
interface ListProps { title: string; items: Item[]; empty: string; admin: boolean; audience: Audience | null; muted?: boolean; onEdit: (c: Standup) => void; onDelete: (c: Standup) => void }

function CallList({ title, items, empty, admin, audience, muted, onEdit, onDelete }: ListProps) {
  const names = (c: Standup) => (c.invitees ?? []).map(i => (i.type === 'team' ? `Team ${audience?.teams.find(t => t.id === i.id)?.name ?? ''}` : audience?.people.find(p => p.id === i.id)?.name ?? '')).filter(Boolean).join(', ');
  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="text-sm font-bold">{title}</h2>
      {items.length === 0 && empty && <p className="text-ui text-lira-muted">{empty}</p>}
      <ul className="space-y-2">
        {items.map(({ call: c, next }) => (
          <li key={c.id} className={`border border-lira-border rounded-lg p-3 flex flex-wrap items-center gap-3 ${muted ? 'opacity-70' : ''}`}>
            <div className="flex-1 min-w-48">
              <p className="text-3xs font-bold uppercase tracking-wider text-lira-muted">{scopeLabel(c)}</p>
              <p className="font-bold">{c.title}</p>
              <p className="text-ui text-lira-muted">{next ? `${c.repeat === 'none' ? '' : muted ? 'Last: ' : 'Next: '}${formatDayDateTime(new Date(next.at))}` : formatDayDateTime(c.startsAt)} · {c.durationMinutes} min</p>
              {repeatSummary(c) && <p className="text-ui text-lira-muted">{repeatSummary(c)}</p>}
              {admin && names(c) && <p className="text-ui text-lira-muted">Invited: {names(c)}</p>}
            </div>
            {isMeetingLink(c.link) && <a href={c.link} target="_blank" rel="noopener noreferrer" className={BUTTON}>Join call</a>}
            {admin && (
              <>
                <button type="button" onClick={() => onEdit(c)} className="rounded px-2 py-1 text-ui border border-lira-border">Change</button>
                <button type="button" onClick={() => onDelete(c)} className="rounded px-2 py-1 text-ui border border-lira-border text-red-600">Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
