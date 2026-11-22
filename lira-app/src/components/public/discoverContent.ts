/** The cards of "Discover the latest": real changes only, with the ones not built yet marked as coming soon. */
export interface DiscoverCard { tag: 'UPDATE' | 'COMING SOON'; title: string; text: string; tone: 'nav' | 'soft' | 'plain' | 'accent' }

export const DISCOVER_CARDS: readonly DiscoverCard[] = [
  { tag: 'UPDATE', title: 'Lira is now Liraspaces', text: 'A new name and a new logo: a hexagon holding an open book.', tone: 'nav' },
  { tag: 'UPDATE', title: 'Six palettes, light and dark', text: 'Pick Sorrel, Fawn, Mossgrove or Tidewell for light mode, and Pace or Blackridge for dark mode.', tone: 'soft' },
  { tag: 'UPDATE', title: 'Roadmaps and weekly snapshots', text: 'Plan epics with Now, Next and Later, and keep dashboard snapshots as files.', tone: 'plain' },
  { tag: 'UPDATE', title: 'Viva drafts, you decide', text: 'Viva proposes changes and nothing is saved until you approve it.', tone: 'accent' },
  { tag: 'COMING SOON', title: 'An MCP server', text: 'Connect the AI tools you already use to your spaces.', tone: 'nav' },
  { tag: 'COMING SOON', title: 'Sign in and organisations', text: 'Accounts, organisations, roles and an audit trail in the hosted edition.', tone: 'soft' },
];

export const TONE_CLASS: Record<DiscoverCard['tone'], string> = {
  nav: 'bg-lira-nav text-white',
  soft: 'bg-lira-blue-light text-lira-text',
  plain: 'bg-gray-100 text-lira-text',
  accent: 'bg-lira-blue text-lira-on-blue',
};
