import type { Grant, Level, ObjectKind, Team } from '../services/accessApi';

export interface AccessRow { grant: Grant; /** The team it comes through, or null when it was given to the person or team directly. */ via: string | null }
export interface Subject { type: 'user' | 'team'; id: string; teamIds?: readonly string[] }

export const KIND_LABEL: Record<ObjectKind, string> = { space: 'Space', project: 'Project', roadmap: 'Roadmap', dashboard: 'Dashboard', storybox: 'Story box', mindmap: 'Storyboard' };
const KIND_PLURAL: Record<ObjectKind, [string, string]> = { space: ['space', 'spaces'], project: ['project', 'projects'], roadmap: ['roadmap', 'roadmaps'], dashboard: ['dashboard', 'dashboards'], storybox: ['story box', 'story boxes'], mindmap: ['storyboard', 'storyboards'] };
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

/** One line saying how much a person or team reaches, such as "2 spaces, 1 project", or "Nothing shared yet". */
export function reachSummary(rows: readonly AccessRow[]): string {
  const counts = new Map<ObjectKind, number>();
  for (const { grant } of rows) counts.set(grant.kind, (counts.get(grant.kind) ?? 0) + 1);
  const parts = (Object.keys(KIND_PLURAL) as ObjectKind[]).filter(k => counts.has(k)).map(k => `${counts.get(k)} ${KIND_PLURAL[k][counts.get(k) === 1 ? 0 : 1]}`);
  return parts.length ? parts.join(', ') : 'Nothing shared yet';
}

/** The letters shown in a person's circle: the first letters of the first and last word of the name, or of the address when there is no name. */
export function initialsOf(name: string, email = ''): string {
  const words = (name.trim() || email.split('@')[0]).split(/[\s._-]+/).filter(Boolean);
  const letters = words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : (words[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

const RANK: Record<Level, number> = { view: 1, edit: 2, manage: 3 };

export interface Cell { direct: Grant | null; /** The best level a team of the person gives, and the team's name. */ inherited: { level: Level; via: string } | null }

/** What one person or team has on one thing: the grant made directly, and for a person the best level their teams give. */
export function cellFor(subject: Subject, kind: ObjectKind, objectId: string, grants: readonly Grant[], teams: readonly Team[]): Cell {
  const on = grants.filter(g => g.kind === kind && g.objectId === objectId);
  const direct = on.find(g => g.subjectType === subject.type && g.subjectId === subject.id) ?? null;
  const viaTeams = subject.type === 'user' ? on.filter(g => g.subjectType === 'team' && subject.teamIds?.includes(g.subjectId)) : [];
  const best = viaTeams.sort((a, b) => RANK[b.level] - RANK[a.level])[0];
  return { direct, inherited: best ? { level: best.level, via: teams.find(t => t.id === best.subjectId)?.name ?? 'a removed team' } : null };
}
