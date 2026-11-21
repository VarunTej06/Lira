import { useState } from 'react';
import { createStandup, isMeetingLink, updateStandup, type Audience, type CreatedStandup, type Invitee, type Standup, type StandupInput } from '../../services/standupsApi';
import { CALL_KIND_LABEL, type CallScope } from '../../utils/callScopes';
import { browserTimeZone, endDateFor, REPEAT_LABEL, type EndChoice, type Repeat } from '../../utils/standupSchedule';
import { BUTTON, FIELD } from '../teams/teamsUi';
import { DatePicker } from '../common/DatePicker';
import { scheduledNote, splitLocal } from './standupTime';

type Length = 'week' | '2weeks' | 'month' | 'days' | 'date';
const LENGTHS: { value: Length; label: string }[] = [
  { value: 'week', label: 'For 1 week' }, { value: '2weeks', label: 'For 2 weeks' }, { value: 'month', label: 'For 1 month' },
  { value: 'days', label: 'For a number of days' }, { value: 'date', label: 'Until a day I choose' },
];

function choiceFor(length: Length, days: number, date: string): EndChoice {
  if (length === 'week') return { kind: 'weeks', count: 1 };
  if (length === '2weeks') return { kind: 'weeks', count: 2 };
  if (length === 'month') return { kind: 'months', count: 1 };
  return length === 'days' ? { kind: 'days', count: days } : { kind: 'date', date };
}

/** `fixedScope`: the call is for this one thing (a popup on a project, say). `scopeChoices`: the person picks what it is for (the Manage calls page). Neither: a call for the whole organisation. */
interface Props { org: string; audience: Audience; editing: Standup | null; fixedScope?: CallScope; scopeChoices?: CallScope[]; onDone: (message?: string) => void; onCancel: () => void }

/**
 * Schedules a stand-up, or changes one. It can happen once, or repeat every day, weekday or week for a week, a month, a number of
 * days or until a day. Leave the link empty to have a Google Meet link made (when Google is connected), or paste a Meet or Teams link.
 */
export function StandupForm({ org, audience, editing, fixedScope, scopeChoices, onDone, onCancel }: Props) {
  const [scopeKey, setScopeKey] = useState(() => (scopeChoices?.[0] ? `${scopeChoices[0].type}:${scopeChoices[0].id}` : 'org:'));
  const chosenScope: CallScope | undefined = fixedScope ?? scopeChoices?.find(c => `${c.type}:${c.id}` === scopeKey);
  const [title, setTitle] = useState(editing?.title ?? (fixedScope && fixedScope.type !== 'org' ? CALL_KIND_LABEL[fixedScope.type] : 'Daily stand-up'));
  const [day, setDay] = useState(editing ? splitLocal(editing.startsAt).day : '');
  const [time, setTime] = useState(editing ? splitLocal(editing.startsAt).time : '10:00');
  const [minutes, setMinutes] = useState(editing?.durationMinutes ?? 15);
  const [link, setLink] = useState(editing?.link ?? '');
  const [repeat, setRepeat] = useState<Repeat>(editing?.repeat ?? 'none');
  const [length, setLength] = useState<Length>(editing?.repeatUntil ? 'date' : 'week');
  const [days, setDays] = useState(5);
  const [until, setUntil] = useState(editing?.repeatUntil ?? '');
  const [chosen, setChosen] = useState(() => new Set((editing?.invitees ?? []).map(i => `${i.type}:${i.id}`)));
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (key: string) => setChosen(prev => { const next = new Set(prev); if (!next.delete(key)) next.add(key); return next; });
  const linkOk = link === '' || isMeetingLink(link.trim());
  const mayLeaveLinkEmpty = audience.canMakeMeetLink && !editing;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invitees: Invitee[] = [...chosen].map(k => { const [type, id] = k.split(':'); return { type: type as Invitee['type'], id }; });
    if (!invitees.length) { setProblem('Invite at least one person or team.'); return; }
    if (!day) { setProblem('Choose the day of the first call.'); return; }
    if (repeat !== 'none' && length === 'date' && !until) { setProblem('Choose the day the repeat ends.'); return; }
    const input: StandupInput = {
      title: title.trim(), startsAt: new Date(`${day}T${time}`).toISOString(), durationMinutes: minutes, timeZone: editing?.timeZone ?? browserTimeZone(), invitees, repeat,
      ...(repeat === 'none' ? {} : { repeatUntil: endDateFor(day, choiceFor(length, days, until)) }),
      ...(link.trim() ? { link: link.trim() } : {}),
      ...(editing || !chosenScope ? {} : { scopeType: chosenScope.type, scopeId: chosenScope.type === 'org' ? undefined : chosenScope.id, scopeName: chosenScope.name }),
    };
    setBusy(true); setProblem('');
    const r = editing ? await updateStandup(org, editing.id, input) : await createStandup(org, input);
    setBusy(false);
    if (!r.ok) { setProblem(r.fields ? Object.values(r.fields)[0] : r.message); return; }
    onDone(editing ? 'Stand-up changed.' : scheduledNote((r.data as CreatedStandup).emailed));
  };

  return (
    <form onSubmit={e => { void submit(e); }} aria-label={editing ? 'Change stand-up' : 'Schedule a stand-up'} className="border border-lira-border rounded-lg p-4 space-y-3 bg-lira-surface">
      {!editing && !fixedScope && scopeChoices && (
        <label className="flex flex-col gap-1 text-ui">What is this call for
          <select aria-label="What is this call for" value={scopeKey} onChange={e => setScopeKey(e.target.value)} className={FIELD}>
            {scopeChoices.map(c => <option key={`${c.type}:${c.id}`} value={`${c.type}:${c.id}`}>{c.type === 'org' ? c.name : `${CALL_KIND_LABEL[c.type]}: ${c.name}`}</option>)}
          </select>
        </label>
      )}
      {(editing || fixedScope) && <p className="text-ui text-lira-muted">{editing ? `${CALL_KIND_LABEL[editing.scopeType]}${editing.scopeName ? `: ${editing.scopeName}` : ''}` : `${CALL_KIND_LABEL[fixedScope!.type]}${fixedScope!.type === 'org' ? '' : `: ${fixedScope!.name}`}`}</p>}
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-ui flex-1 min-w-48">Title<input required value={title} onChange={e => setTitle(e.target.value)} className={FIELD} /></label>
        <div className="flex flex-col gap-1 text-ui"><span>First day</span><DatePicker aria-label="First day" value={day} onChange={setDay} clearable={false} placeholder="Choose a day" /></div>
        <label className="flex flex-col gap-1 text-ui">Time<input type="time" required value={time} onChange={e => setTime(e.target.value)} className={FIELD} aria-label="Start time" /></label>
        <label className="flex flex-col gap-1 text-ui">Minutes<input type="number" min={5} max={240} required value={minutes} onChange={e => setMinutes(Number(e.target.value))} className={`${FIELD} w-24`} /></label>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1 text-ui">Repeats
          <select aria-label="Repeats" value={repeat} onChange={e => setRepeat(e.target.value as Repeat)} className={FIELD}>
            {(Object.keys(REPEAT_LABEL) as Repeat[]).map(r => <option key={r} value={r}>{REPEAT_LABEL[r]}</option>)}
          </select>
        </label>
        {repeat !== 'none' && (
          <>
            <label className="flex flex-col gap-1 text-ui">For how long
              <select aria-label="For how long" value={length} onChange={e => setLength(e.target.value as Length)} className={FIELD}>{LENGTHS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select>
            </label>
            {length === 'days' && <label className="flex flex-col gap-1 text-ui">Days<input type="number" min={1} max={366} value={days} onChange={e => setDays(Number(e.target.value))} className={`${FIELD} w-24`} aria-label="Number of days" /></label>}
            {length === 'date' && <div className="flex flex-col gap-1 text-ui"><span>Last day</span><DatePicker aria-label="Last day" value={until} onChange={setUntil} min={day || undefined} clearable={false} placeholder="Choose a day" /></div>}
          </>
        )}
      </div>

      <label className="flex flex-col gap-1 text-ui">Call link {mayLeaveLinkEmpty ? '(leave empty to make a Google Meet link)' : '(Google Meet or Microsoft Teams)'}
        <input type="url" required={!mayLeaveLinkEmpty} value={link} onChange={e => setLink(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" className={FIELD} aria-invalid={!linkOk} />
      </label>
      {!linkOk && <p role="alert" className="text-ui text-red-600">Use a Google Meet or Microsoft Teams link, starting with https://.</p>}
      {!audience.canMakeMeetLink && !editing && <p className="text-ui text-lira-muted">Google is not connected, so paste a link. The owner can connect Google at the top of this page to have Meet links made for you.</p>}

      <fieldset className="space-y-1">
        <legend className="text-ui font-bold">Who is invited</legend>
        <div className="grid sm:grid-cols-2 gap-1 max-h-44 overflow-auto">
          {audience.teams.map(t => <label key={t.id} className="flex items-center gap-2 text-ui"><input type="checkbox" checked={chosen.has(`team:${t.id}`)} onChange={() => toggle(`team:${t.id}`)} />Team: {t.name}</label>)}
          {audience.people.map(p => <label key={p.id} className="flex items-center gap-2 text-ui"><input type="checkbox" checked={chosen.has(`user:${p.id}`)} onChange={() => toggle(`user:${p.id}`)} />{p.name}</label>)}
        </div>
      </fieldset>
      {problem && <p role="alert" className="text-ui text-red-600">{problem}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !linkOk} className={BUTTON}>{busy ? 'Saving' : editing ? 'Save changes' : 'Schedule'}</button>
        <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-ui border border-lira-border">Cancel</button>
      </div>
    </form>
  );
}
