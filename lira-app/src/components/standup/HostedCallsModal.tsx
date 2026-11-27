import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteStandup, isMeetingLink, listStandups, standupAudience, type Audience, type Standup } from '../../services/standupsApi';
import { currentTimeMs } from '../../utils/clock';
import { formatDayDateTime } from '../../utils/dateUtils';
import { activeOrg } from '../../utils/hostedOrg';
import { CALL_KIND_LABEL, isForScope, type CallScope } from '../../utils/callScopes';
import { nextOccurrence, repeatSummary } from '../../utils/standupSchedule';
import { confirmDialog } from '../common/dialogStore';
import { Modal } from '../common/Modal';
import { Skeleton } from '../common/Skeleton';
import { StandupForm } from '../standups/StandupForm';
import { BUTTON } from '../teams/teamsUi';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; calls: Standup[]; audience: Audience | null };

interface Props { scope: CallScope; canManage: boolean; onClose: () => void }

/**
 * The popup of a call button (on a space, project or sprint): the calls of that one thing, each with a Join link. Owners and Admins can
 * also schedule a call here, change one that exists, delete it, or go to the Manage calls page for all calls of every kind.
 */
export function HostedCallsModal({ scope, canManage, onClose }: Props) {
  const org = activeOrg();
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [reloads, setReloads] = useState(0);
  const [form, setForm] = useState<{ editing: Standup | null } | null>(null);
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState('');
  const [now] = useState(currentTimeMs);
  const { type: scopeType, id: scopeId } = scope;
  const label = CALL_KIND_LABEL[scopeType];

  useEffect(() => {
    if (!org) return;
    let current = true;
    void (async () => {
      const calls = await listStandups(org);
      if (!current) return;
      if (!calls.ok) { setLoad({ state: 'error', message: calls.message }); return; }
      const audience = canManage ? await standupAudience(org) : null;
      if (current) setLoad({ state: 'ready', calls: calls.data.filter(c => isForScope(c, { type: scopeType, id: scopeId })), audience: audience?.ok ? audience.data : null });
    })();
    return () => { current = false; };
  }, [org, reloads, canManage, scopeType, scopeId]);

  const reload = () => setReloads(n => n + 1);
  const remove = async (call: Standup) => {
    if (!(await confirmDialog({ title: `Delete "${call.title}"?`, message: 'It disappears for everyone invited.', confirmLabel: 'Delete', tone: 'danger' }))) return;
    const r = await deleteStandup(org!, call.id);
    if (r.ok) reload(); else setProblem(r.message);
  };
  const manage = () => { onClose(); navigate('/settings/calls'); };

  return (
    <Modal isOpen onClose={onClose} title={`${label}: ${scope.name}`} size="lg">
      <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
        {!org && <p role="alert" className="text-ui text-red-600">You are not signed in to an organisation.</p>}
        {org && load.state === 'loading' && <div role="status" aria-label="Loading calls" className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>}
        {load.state === 'error' && <p role="alert" className="text-ui text-red-600">{load.message} <button type="button" onClick={() => { setLoad({ state: 'loading' }); reload(); }} className="underline">Try again</button></p>}
        {notice && <p role="status" className="text-ui">{notice}</p>}
        {problem && <p role="alert" className="text-ui text-red-600">{problem}</p>}

        {load.state === 'ready' && form && load.audience && (
          <StandupForm org={org!} audience={load.audience} editing={form.editing} fixedScope={scope} onCancel={() => setForm(null)} onDone={message => { setForm(null); setNotice(message ?? ''); reload(); }} />
        )}

        {load.state === 'ready' && !form && (
          <>
            {load.calls.length === 0 && <p className="text-ui text-lira-muted">No {label.toLowerCase()} is scheduled here.</p>}
            <ul className="space-y-2">
              {load.calls.map(c => {
                const next = nextOccurrence(c, now);
                return (
                  <li key={c.id} className="border border-lira-border rounded-lg p-3 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-48">
                      <p className="font-bold">{c.title}</p>
                      <p className="text-ui text-lira-muted">{next ? `${c.repeat === 'none' ? '' : next.over ? 'Last: ' : 'Next: '}${formatDayDateTime(new Date(next.at))}` : formatDayDateTime(c.startsAt)} · {c.durationMinutes} min</p>
                      {repeatSummary(c) && <p className="text-ui text-lira-muted">{repeatSummary(c)}</p>}
                    </div>
                    {isMeetingLink(c.link) && <a href={c.link} target="_blank" rel="noopener noreferrer" className={BUTTON}>Join call</a>}
                    {canManage && load.audience && (
                      <>
                        <button type="button" onClick={() => { setNotice(''); setForm({ editing: c }); }} className="rounded px-2 py-1 text-ui border border-lira-border">Change</button>
                        <button type="button" onClick={() => { void remove(c); }} className="rounded px-2 py-1 text-ui border border-lira-border text-red-600">Delete</button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            {canManage && (
              <div className="flex flex-wrap gap-2 pt-1">
                {load.audience && <button type="button" onClick={() => { setNotice(''); setForm({ editing: null }); }} className={BUTTON}>Schedule a {label.toLowerCase()}</button>}
                <button type="button" onClick={manage} className="rounded px-3 py-1.5 text-ui border border-lira-border">Manage calls</button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
