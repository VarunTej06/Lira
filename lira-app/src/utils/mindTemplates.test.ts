import { describe, expect, it } from 'vitest';
import { layoutMap } from './mindLayout';
import { childrenOf, rootOf } from './mindmap';
import { fromTemplate, MIND_TEMPLATES } from './mindTemplates';

const ids = () => { let n = 0; return () => `n${++n}`; };
const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('storyboard templates', () => {
  it('each one has a single central idea, and nothing is missing a parent', () => {
    for (const t of MIND_TEMPLATES) {
      const { nodes } = fromTemplate(t.id, ids());
      expect(nodes.filter(n => n.parentId === null), t.id).toHaveLength(1);
      const known = new Set(nodes.map(n => n.id));
      expect(nodes.every(n => n.parentId === null || known.has(n.parentId)), t.id).toBe(true);
    }
  });

  it('are different kinds of board, not one tree with different words: the notes and flow ones carry shapes, and the plain ones do not', () => {
    const withShapes = (id: string) => fromTemplate(id, ids()).free.shapes.length;
    expect(withShapes('blank')).toBe(0);
    expect(withShapes('mindmap')).toBe(0);
    for (const id of ['brainstorm', 'meeting', 'retro', 'decision', 'flowchart']) expect(withShapes(id), id).toBeGreaterThan(3);
    const kinds = (id: string) => new Set(fromTemplate(id, ids()).free.shapes.map(s => s.kind));
    expect(kinds('meeting').has('note')).toBe(true);
    expect(kinds('flowchart').has('ellipse')).toBe(true);
    expect(kinds('flowchart').has('note')).toBe(false);
  });

  it('meeting notes are sticky notes for the agenda, notes, decisions and actions, with a small map of decisions under them', () => {
    const { nodes, free } = fromTemplate('meeting', ids());
    expect(free.shapes.filter(s => s.kind === 'note').length).toBeGreaterThanOrEqual(8);
    expect(free.shapes.filter(s => s.kind === 'box').map(s => s.text)).toEqual(['Agenda', 'Notes', 'Decisions', 'Actions']);
    expect(rootOf(nodes)!.text).toBe('Decisions');
    expect(childrenOf(nodes, rootOf(nodes)!.id).length).toBeGreaterThanOrEqual(3);
    expect(free.links).toEqual([]); // nothing is drawn across the notes
  });

  it('every line joins two things that are there, the central idea included', () => {
    expect(MIND_TEMPLATES.some(t => (t.links ?? []).some(l => l.from === 'root' || l.to === 'root'))).toBe(true);
    for (const t of MIND_TEMPLATES) {
      const { nodes, free } = fromTemplate(t.id, ids());
      const known = new Set([...nodes.map(n => n.id), ...free.shapes.map(s => s.id)]);
      expect(free.links.every(l => known.has(l.from) && known.has(l.to) && l.from !== l.to && l.arrow), t.id).toBe(true);
    }
  });

  it('keep every shape clear of the map of ideas and of each other, so nothing is drawn over anything', () => {
    for (const t of MIND_TEMPLATES) {
      const { nodes, free } = fromTemplate(t.id, ids());
      const tree = [...layoutMap(nodes).values()];
      for (const s of free.shapes) for (const b of tree) expect(overlap(s, b), `${t.id}: ${s.text} over the map`).toBe(false);
      for (let i = 0; i < free.shapes.length; i++) for (let j = i + 1; j < free.shapes.length; j++) expect(overlap(free.shapes[i], free.shapes[j]), `${t.id}: ${free.shapes[i].text} over ${free.shapes[j].text}`).toBe(false);
    }
  });

  it('the plain ones keep their size: blank is the central idea alone, the storyboard has at least three branches', () => {
    expect(fromTemplate('blank', ids()).nodes).toHaveLength(1);
    const { nodes } = fromTemplate('mindmap', ids());
    expect(childrenOf(nodes, rootOf(nodes)!.id).length).toBeGreaterThanOrEqual(3);
  });

  it('gives the blank board for a template that does not exist, and every id different', () => {
    expect(fromTemplate('nope', ids()).nodes).toHaveLength(1);
    const { nodes, free } = fromTemplate('flowchart', ids());
    const all = [...nodes.map(n => n.id), ...free.shapes.map(s => s.id), ...free.links.map(l => l.id)];
    expect(new Set(all).size).toBe(all.length);
  });

  it('has a name and a line about each, and no two the same id', () => {
    expect(new Set(MIND_TEMPLATES.map(t => t.id)).size).toBe(MIND_TEMPLATES.length);
    expect(MIND_TEMPLATES.every(t => t.name && t.about)).toBe(true);
    expect(MIND_TEMPLATES.length).toBeGreaterThanOrEqual(6);
  });
});
