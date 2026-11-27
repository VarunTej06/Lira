import type { Grant, Level, ObjectKind, Team } from '../services/accessApi';

export interface AccessRow { grant: Grant; /** The team it comes through, or null when it was given to the person or team directly. */ via: string | null }
export interface Subject { type: 'user' | 'team'; id: string; teamIds?: readonly string[] }

export const KIND_LABEL: Record<ObjectKind, string> = { space: 'Space', project: 'Project', roadmap: 'Roadmap', dashboard: 'Dashboard', storybox: 'Story box', mindmap: 'Storyboard' };
export const LEVEL_LABEL: Record<Level, string> = { view: 'Can view', edit: 'Can edit', manage: 'Can manage' };

/** What a person or team can reach: what was given to them, and for a person also what their teams were given. Direct ones come first. */
export function accessFor(subject: Subject, grants: readonly Grant[], teams: readonly Team[]): AccessRow[] {
  const direct = grants.filter(g => g.subjectType === subject.type && g.subjectId === subject.id).map(grant => ({ grant, via: null }));
  const inherited = subject.type === 'user'
    ? grants.filter(g => g.subjectType === 'team' && subject.teamIds?.includes(g.subjectId)).map(grant => ({ grant, via: teams.find(t => t.id === grant.subjectId)?.name ?? 'a removed team' }))
    : [];
  return [...direct, ...inherited];
}

export interface Choice { id: string; name: string }
export type ObjectChoices = Record<ObjectKind, Choice[]>;

/** The name of a shared thing, or a plain word when it has since been deleted. */
export const objectName = (choices: ObjectChoices, kind: ObjectKind, id: string): string => choices[kind].find(c => c.id === id)?.name ?? 'Removed item';
