/** The day (year-month-day) and the clock time (hour:minute) of a moment, in the person's own time zone, as the date picker and the time field want them. */
export function splitLocal(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

/** What to tell the person after a stand-up is scheduled, from how many invitation emails went out. */
export function scheduledNote(emailed: { sent: number; total: number }): string {
  if (emailed.total === 0) return 'Stand-up scheduled.';
  if (emailed.sent === emailed.total) return `Stand-up scheduled. ${emailed.sent} invitation ${emailed.sent === 1 ? 'email' : 'emails'} sent.`;
  return 'Stand-up scheduled. Email is not connected yet, so nobody was emailed: people see it under Stand-up calls.';
}
