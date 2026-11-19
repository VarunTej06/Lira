/**
 * The menu of the top bar, in order. An entry is either a menu with items or a single link. Items that point at pages not
 * written yet lead to the coming-soon page, so no link is dead. There is no pricing entry: Liraspaces is free while it is built.
 */
export interface NavItem { label: string; to: string }
export type NavEntry = NavItem | { label: string; items: readonly NavItem[] };

const later = (label: string): NavItem => ({ label, to: '/coming-soon' });
const section = (label: string): NavItem => ({ label, to: '/#inside' });

export const NAV: readonly NavEntry[] = [
  { label: 'Features', items: ['Boards and tickets', 'Sprints', 'Roadmaps', 'Dashboards', 'Viva'].map(section) },
  { label: 'Solutions', items: ['For learners', 'For teams', 'For managers'].map(later) },
  later('Guides'),
  { label: 'Templates', items: ['Certification study plan', 'Sprint planning', 'Product roadmap'].map(later) },
];

export const isMenu = (entry: NavEntry): entry is { label: string; items: readonly NavItem[] } => 'items' in entry;
