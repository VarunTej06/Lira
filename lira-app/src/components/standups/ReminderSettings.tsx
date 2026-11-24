import { useEffect, useState } from 'react';
import { getReminders, setReminders, type ReminderPrefs } from '../../services/reminderApi';

/** The person's own switches for the reminder emails: before a call they are invited to, and the day before a ticket assigned to them is due. */
export function ReminderSettings() {
  const [prefs, setPrefs] = useState<ReminderPrefs | null>(null);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    let current = true;
    void getReminders().then(r => { if (current && r.ok) setPrefs(r.data); });
    return () => { current = false; };
  }, []);

  async function change(key: 'calls' | 'due', on: boolean) {
    setProblem('');
    const r = await setReminders({ [key]: on });
    if (r.ok) setPrefs(r.data); else setProblem(r.message);
  }

  if (!prefs) return null;
  return (
    <section aria-label="Reminders" className="border border-lira-border rounded-lg px-4 py-3 text-ui space-y-1.5">
      <h2 className="font-bold">Reminders by email</h2>
      {!prefs.available && <p className="text-lira-muted">Email is not set up on this server, so no reminders are sent.</p>}
      <label className="flex items-center gap-2"><input type="checkbox" disabled={!prefs.available} checked={prefs.calls} onChange={e => { void change('calls', e.target.checked); }} />15 minutes before a call I am invited to</label>
      <label className="flex items-center gap-2"><input type="checkbox" disabled={!prefs.available} checked={prefs.due} onChange={e => { void change('due', e.target.checked); }} />The day before a ticket assigned to me is due</label>
      {problem && <p role="alert" className="text-red-600">{problem}</p>}
    </section>
  );
}
