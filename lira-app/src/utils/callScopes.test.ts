import { describe, expect, it } from 'vitest';
import { CALL_KIND_LABEL, CALL_KIND_PLURAL, CALL_KINDS, isForScope, scopeLabel } from './callScopes';

describe('kinds of call', () => {
  it('are a stand-up for the whole organisation, and a space call, a project sync and a sprint call', () => {
    expect(CALL_KINDS).toEqual(['org', 'space', 'project', 'sprint']);
    expect(CALL_KIND_LABEL).toEqual({ org: 'Stand-up', space: 'Space call', project: 'Project sync', sprint: 'Sprint call' });
    expect(Object.keys(CALL_KIND_PLURAL)).toEqual(CALL_KINDS);
  });
});

describe('isForScope', () => {
  const call = { scopeType: 'project' as const, scopeId: 'project:proj-a' };
  it('is true only for the same kind and the same thing', () => {
    expect(isForScope(call, { type: 'project', id: 'project:proj-a' })).toBe(true);
    expect(isForScope(call, { type: 'project', id: 'project:proj-b' })).toBe(false);
    expect(isForScope(call, { type: 'space', id: 'project:proj-a' })).toBe(false);
    expect(isForScope({ scopeType: 'org', scopeId: '' }, { type: 'org', id: '' })).toBe(true);
  });
});

describe('scopeLabel', () => {
  it('names the kind and the thing, or just the kind for the whole organisation or when there is no name', () => {
    expect(scopeLabel({ scopeType: 'project', scopeName: 'Lira Core Platform' })).toBe('Project sync: Lira Core Platform');
    expect(scopeLabel({ scopeType: 'sprint', scopeName: '' })).toBe('Sprint call');
    expect(scopeLabel({ scopeType: 'org', scopeName: 'ignored' })).toBe('Stand-up');
  });
});
