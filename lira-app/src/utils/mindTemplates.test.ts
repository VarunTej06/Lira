import { describe, expect, it } from 'vitest';
import { childrenOf, rootOf } from './mindmap';
import { fromTemplate, MIND_TEMPLATES } from './mindTemplates';

const ids = () => { let n = 0; return () => `n${++n}`; };

describe('mind map templates', () => {
  it('each one makes a central idea with branches under it, and nothing is missing a parent', () => {
    for (const t of MIND_TEMPLATES) {
      const nodes = fromTemplate(t.id, ids());
      expect(nodes.filter(n => n.parentId === null), t.id).toHaveLength(1);
      const known = new Set(nodes.map(n => n.id));
      expect(nodes.every(n => n.parentId === null || known.has(n.parentId)), t.id).toBe(true);
    }
  });
  it('the blank one is only the central idea, and the others have at least three main branches', () => {
    expect(fromTemplate('blank', ids())).toHaveLength(1);
    for (const t of MIND_TEMPLATES.filter(x => x.id !== 'blank')) {
      const nodes = fromTemplate(t.id, ids());
      expect(childrenOf(nodes, rootOf(nodes)!.id).length, t.id).toBeGreaterThanOrEqual(3);
    }
  });
  it('gives the blank map for a template that does not exist', () => {
    expect(fromTemplate('nope', ids())).toHaveLength(1);
  });
  it('has a name and a line about each, and no two the same id', () => {
    expect(new Set(MIND_TEMPLATES.map(t => t.id)).size).toBe(MIND_TEMPLATES.length);
    expect(MIND_TEMPLATES.every(t => t.name && t.about)).toBe(true);
  });
});
