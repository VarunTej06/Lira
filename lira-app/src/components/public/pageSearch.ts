/** The search of the public pages: it finds a page or a section by its title or its words. The app has its own search of tickets. */
export interface SiteEntry { title: string; text: string; to: string }

export const SITE_ENTRIES: readonly SiteEntry[] = [
  { title: 'Boards and tickets', text: 'Plan a course, a certification or a project as tickets and move them across a board.', to: '/#inside' },
  { title: 'Sprints', text: 'Set a goal, pull tickets in, and see what finished.', to: '/#inside' },
  { title: 'Roadmaps', text: 'Lay epics out over time, with Now, Next and Later.', to: '/#inside' },
  { title: 'Dashboards', text: 'Charts for status, workload and progress, saved as weekly snapshots.', to: '/#inside' },
  { title: 'Viva', text: 'The built-in assistant that finds tickets and drafts changes you approve.', to: '/#inside' },
  { title: 'Your data', text: 'Separate by organisation, works offline, and downloadable in one file.', to: '/#data' },
  { title: 'Get started', text: 'Create your account. Free while we build it.', to: '/signup' },
  { title: 'Log in', text: 'Log in to continue.', to: '/login' },
  { title: 'Terms of Service', text: 'The terms for using Liraspaces.', to: '/terms' },
  { title: 'Privacy Policy', text: 'What we collect, why, and your rights.', to: '/privacy' },
  { title: 'User Notice', text: 'A short notice about the data we collect.', to: '/notice' },
];

const MAX_QUERY = 80;

/** Entries whose title or text contains every word typed, titles first. Nothing is returned for an empty query. */
export function searchSite(query: string, entries: readonly SiteEntry[] = SITE_ENTRIES, limit = 6): SiteEntry[] {
  const words = query.slice(0, MAX_QUERY).toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const rank = (e: SiteEntry): number => {
    const title = e.title.toLowerCase();
    const all = `${title} ${e.text.toLowerCase()}`;
    if (!words.every(w => all.includes(w))) return -1;
    return words.every(w => title.includes(w)) ? 0 : 1;
  };
  return entries.map(e => ({ e, r: rank(e) })).filter(x => x.r >= 0).sort((a, b) => a.r - b.r).slice(0, limit).map(x => x.e);
}
