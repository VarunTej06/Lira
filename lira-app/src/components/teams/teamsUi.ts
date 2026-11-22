import type { AssignableRole, Level } from '../../services/accessApi';

export const ROLES: { value: AssignableRole; label: string; help: string }[] = [
  { value: 'admin', label: 'Admin', help: 'Everything in the organisation except changing roles' },
  { value: 'member', label: 'Member', help: 'Sees and does only what is granted' },
  { value: 'viewer', label: 'Viewer', help: 'Can only view what is granted' },
  { value: 'guest', label: 'Guest', help: 'Only what is granted, never manages' },
];

export const FIELD = 'border border-lira-border rounded px-2 py-1 text-ui bg-lira-surface text-lira-text';
export const BUTTON = 'rounded px-3 py-1.5 text-ui font-bold bg-lira-blue text-lira-on-blue disabled:opacity-60';
export const LEVELS: { value: Level; label: string; help: string }[] = [
  { value: 'view', label: 'Can view', help: 'Read it and everything in it' },
  { value: 'edit', label: 'Can edit', help: 'Add, change and delete entries inside it, but not create new roadmaps, projects or sprints' },
  { value: 'manage', label: 'Can manage', help: 'Edit, plus create, delete and share inside it' },
];
