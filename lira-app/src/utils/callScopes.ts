/** What a call is for: the whole organisation (a stand-up), a space, a project or a sprint. */
export type CallScopeType = 'org' | 'space' | 'project' | 'sprint';

export interface CallScope { type: CallScopeType; id: string; name: string }

/** The name people use for each kind of call. */
export const CALL_KIND_LABEL: Record<CallScopeType, string> = { org: 'Stand-up', space: 'Space call', project: 'Project sync', sprint: 'Sprint call' };
export const CALL_KIND_PLURAL: Record<CallScopeType, string> = { org: 'Stand-ups', space: 'Space calls', project: 'Project syncs', sprint: 'Sprint calls' };
export const CALL_KINDS: readonly CallScopeType[] = ['org', 'space', 'project', 'sprint'];

/** The one call a thing's popup is about: same kind and same thing. */
export const isForScope = (call: { scopeType: CallScopeType; scopeId: string }, scope: Pick<CallScope, 'type' | 'id'>): boolean => call.scopeType === scope.type && call.scopeId === scope.id;

/** "Project sync: Lira Core Platform", or just "Stand-up" for the whole organisation. */
export const scopeLabel = (call: { scopeType: CallScopeType; scopeName: string }): string =>
  call.scopeType === 'org' || !call.scopeName ? CALL_KIND_LABEL[call.scopeType] : `${CALL_KIND_LABEL[call.scopeType]}: ${call.scopeName}`;
