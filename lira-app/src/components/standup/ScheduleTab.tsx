import { Video, Download, Mail, Trash2, ExternalLink, Calendar } from 'lucide-react';
import { DatePicker } from '../common/DatePicker';
import { safeHttpUrl } from '../../utils/safeUrl';
import { PLATFORM_LABEL, REPEAT_LABEL, type Platform, type Repeat } from '../../utils/standupUtils';
import { FIELD, LABEL } from './parts';
import { todayStr, type StandupState } from './useStandup';

/** Plan a (repeating) call and send the invite through the person's own calendar or mail. */
export function ScheduleTab(s: StandupState) {
  const { scope, saved, invited, invitedEmails, missingEmail, setTab } = s;
  const actions = [
    { label: 'Google Meet invite', hint: 'Pre-filled Google Calendar event, whole team as guests', Icon: Video, tint: 'bg-emerald-100 text-emerald-700', run: s.sendGoogle },
    { label: 'Microsoft Teams invite', hint: 'Pre-filled Teams meeting with all attendees', Icon: Video, tint: 'bg-indigo-100 text-indigo-700', run: s.sendTeams },
    { label: 'Download .ics', hint: 'Works with Outlook, Apple Calendar and others', Icon: Download, tint: 'bg-amber-100 text-amber-700', run: s.downloadIcs },
    { label: 'Email the team', hint: 'Draft with time and tickets that need updates', Icon: Mail, tint: 'bg-sky-100 text-sky-700', run: s.emailTeam },
  ];

  return (
    <>
      {saved.length > 0 && (
        <section className="border border-lira-border rounded-2xl overflow-hidden bg-white">
          <header className="px-3 py-2 bg-gray-50 border-b border-lira-border text-xs font-semibold text-lira-text uppercase tracking-wide">Scheduled calls</header>
          {saved.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2 border-b border-lira-border last:border-0">
              <Video className="w-4 h-4 text-lira-blue flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-lira-text truncate">{c.title}</div>
                <div className="text-[11px] text-lira-muted">{REPEAT_LABEL[c.repeat]} · {c.time} · {c.duration} min · {PLATFORM_LABEL[c.platform]} · {c.memberKeys.length} people</div>
              </div>
              {safeHttpUrl(c.link) && (
                <a href={safeHttpUrl(c.link)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-lira-blue text-white hover:bg-lira-blue-hover">
                  Join <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <button onClick={() => s.removeSaved(c.id)} className="p-1.5 rounded-lg text-lira-muted hover:text-red-600 hover:bg-red-50 cursor-pointer" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </section>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className={LABEL}>Title</label>
          <input className={FIELD} value={s.title} onChange={e => s.setTitle(e.target.value)} />
        </div>
        <div>
          <label className={LABEL}>Start date</label>
          <DatePicker value={s.startDate} min={todayStr()} onChange={s.setStartDate} clearable={false} aria-label="Start date" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Time</label>
            <input type="time" className={FIELD} value={s.time} onChange={e => s.setTime(e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Length</label>
            <select className={FIELD} value={s.duration} onChange={e => s.setDuration(Number(e.target.value))}>
              {[10, 15, 20, 30, 45, 60].map(m => <option key={m} value={m}>{m} min</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={LABEL}>Repeats</label>
          <select className={FIELD} value={s.repeat} onChange={e => s.setRepeat(e.target.value as Repeat)}>
            {(Object.keys(REPEAT_LABEL) as Repeat[]).map(r => <option key={r} value={r}>{REPEAT_LABEL[r]}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Meeting tool your team uses</label>
          <select className={FIELD} value={s.platform} onChange={e => s.setPlatform(e.target.value as Platform)}>
            {(Object.keys(PLATFORM_LABEL) as Platform[]).map(p => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL}>Meeting link (optional — paste it after creating the invite so “Join” works)</label>
          <input className={FIELD} value={s.link} onChange={e => s.setLink(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" />
        </div>
      </div>

      <div className="rounded-2xl border border-lira-border bg-gray-50 px-4 py-3 text-xs text-lira-muted">
        Inviting the <strong className="text-lira-text">{scope.name}</strong> team: <strong className="text-lira-text">{invitedEmails.length}</strong> of {invited.length} people have an email
        {missingEmail.length > 0 && <> — missing: {missingEmail.map(m => m.name).join(', ')} (<button className="text-lira-blue underline cursor-pointer" onClick={() => setTab('team')}>add emails</button>)</>}.
        Lira opens a pre-filled invite for everyone; you confirm it in your calendar, which then emails the whole team.
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        {actions.map(({ label, hint, Icon, tint, run }) => (
          <button key={label} onClick={run} className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-lira-border bg-white hover:border-lira-blue hover:bg-blue-50/40 transition-colors text-left cursor-pointer">
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${tint}`}><Icon className="w-4 h-4" /></span>
            <span><span className="block text-sm font-semibold text-lira-text">{label}</span><span className="block text-[11px] text-lira-muted">{hint}</span></span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={() => window.open('https://meet.google.com/new', '_blank', 'noopener')} className="text-xs text-lira-blue hover:underline cursor-pointer flex items-center gap-1">
          <Video className="w-3.5 h-3.5" /> Start an instant Google Meet now
        </button>
        <button onClick={s.saveOnly} className="text-sm px-4 py-2 rounded-xl bg-lira-blue text-white hover:bg-lira-blue-hover cursor-pointer flex items-center gap-1.5">
          <Calendar className="w-4 h-4" /> Save call
        </button>
      </div>
    </>
  );
}
