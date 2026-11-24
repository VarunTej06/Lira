import type { ObjectType } from './objects.service';

/** The one space a project, roadmap or dashboard belongs to: by number, by key, or none. */
export interface TiedSpace { id?: number; key?: string }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Which space an object is tied to, read from its body: a project names a space by number, a roadmap by key, and a dashboard is tied
 * only when its filters name exactly one space (a dashboard across several spaces belongs to none of them). People who may use a space
 * may use what is tied to it, so a person invited to one space sees its projects, roadmaps and single-space dashboards and nothing else.
 */
export function tiedSpace(kind: ObjectType, doc: Record<string, unknown>): TiedSpace | null {
  if (kind === 'project') return Number.isInteger(doc.spaceId) && (doc.spaceId as number) > 0 ? { id: doc.spaceId as number } : null;
  // A story box for one space is tied to it; one for a sprint crosses spaces, so it is shared by access only.
  if (kind === 'storybox') return isObject(doc.scope) && doc.scope.type === 'space' && Number.isInteger(doc.scope.spaceId) && (doc.scope.spaceId as number) > 0 ? { id: doc.scope.spaceId as number } : null;
  if (kind === 'mindmap') return null;
  if (kind === 'roadmap') return typeof doc.spaceKey === 'string' && doc.spaceKey ? { key: doc.spaceKey } : null;
  const ids = isObject(doc.filters) ? doc.filters.spaceIds : undefined;
  return Array.isArray(ids) && ids.length === 1 && Number.isInteger(ids[0]) && (ids[0] as number) > 0 ? { id: ids[0] as number } : null;
}
