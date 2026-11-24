import { describe, expect, it } from 'vitest';
import {
  addComment, addLink, arrowHead, mergeBounds, pinAt, addShape, edgePoint, editComment, EMPTY_FREE, freeBounds, linkEnds, MAX_COMMENTS, MAX_LINKS, MAX_SHAPES, MIN_H, MIN_W, moveShape, newShape,
  readFree, removeItem, toggleResolved, updateLink, updateShape, wrapLines, type FreeDoc, type Link, type MindComment,
} from './mindFree';

const comment = (id: string, over: Partial<MindComment> = {}): MindComment => ({ id, targetId: null, x: 0, y: 0, text: 'Hello', author: 'Asha', at: '2026-11-24T10:00:00Z', ...over });
const link = (id: string, from: string, to: string): Link => ({ id, from, to, arrow: true });
const two = (): FreeDoc => addShape(addShape(EMPTY_FREE, newShape('box', 'a', 100, 100)), newShape('ellipse', 'b', 400, 100));

describe('placing shapes', () => {
  it('puts a new shape with its middle where it was asked, with the usual size and a word to start with', () => {
    const s = newShape('box', 'a', 100, 100);
    expect(s).toMatchObject({ kind: 'box', w: 160, h: 64, text: 'Box', x: 20, y: 68 });
    expect(newShape('note', 'n', 0, 0).h).toBeGreaterThan(newShape('text', 't', 0, 0).h);
  });
  it('adds shapes up to a limit and then stops', () => {
    let f = EMPTY_FREE;
    for (let i = 0; i < MAX_SHAPES + 5; i++) f = addShape(f, newShape('box', `s${i}`, i, i));
    expect(f.shapes).toHaveLength(MAX_SHAPES);
  });
  it('changes a shape, keeps it from getting smaller than a readable size, cuts a long text, and moves it', () => {
    let f = updateShape(two(), 'a', { text: 'x'.repeat(900), w: 5, h: 5, bold: true, color: '#123456' });
    const a = f.shapes[0];
    expect(a.text).toHaveLength(500);
    expect([a.w, a.h]).toEqual([MIN_W, MIN_H]);
    expect(a).toMatchObject({ bold: true, color: '#123456' });
    f = moveShape(f, 'a', 10.4, -20);
    expect([f.shapes[0].x, f.shapes[0].y]).toEqual([a.x + 10, a.y - 20]);
    expect(f.shapes[1]).toEqual(two().shapes[1]); // the other one is untouched
  });
});

describe('lines', () => {
  const known = new Set(['a', 'b', 'idea1']);
  it('joins two items, a shape and an idea of the tree included, with or without an arrow', () => {
    let f = addLink(two(), known, link('l1', 'a', 'b'));
    f = addLink(f, known, { ...link('l2', 'b', 'idea1'), arrow: false });
    expect(f.links.map(l => l.id)).toEqual(['l1', 'l2']);
    expect(f.links[1].arrow).toBe(false);
  });
  it('refuses an item joined to itself, an item that is not there, and the same pair again, either way round', () => {
    const base = addLink(two(), known, link('l1', 'a', 'b'));
    expect(addLink(base, known, link('x', 'a', 'a'))).toBe(base);
    expect(addLink(base, known, link('x', 'a', 'ghost'))).toBe(base);
    expect(addLink(base, known, link('x', 'a', 'b'))).toBe(base);
    expect(addLink(base, known, link('x', 'b', 'a'))).toBe(base);
  });
  it('stops at the limit, and changes the look of a line', () => {
    let f: FreeDoc = { ...EMPTY_FREE, links: Array.from({ length: MAX_LINKS }, (_, i) => link(`l${i}`, 'p', 'q')) };
    expect(addLink(f, known, link('z', 'a', 'b'))).toBe(f);
    f = updateLink(addLink(two(), known, link('l1', 'a', 'b')), 'l1', { dashed: true, arrow: false, color: '#ff0000' });
    expect(f.links[0]).toMatchObject({ dashed: true, arrow: false, color: '#ff0000' });
  });
  it('ends each line on the edge of the items it joins, not in their middle, and gives nothing for an item that is missing', () => {
    const f = addLink(two(), known, link('l1', 'a', 'b'));
    const items = new Map(f.shapes.map(s => [s.id, { x: s.x, y: s.y, w: s.w, h: s.h, ellipse: s.kind === 'ellipse' }]));
    const ends = linkEnds(f.links[0], items)!;
    const a = items.get('a')!;
    expect(ends.a.x).toBeCloseTo(a.x + a.w, 5); // the right edge of the box, level with its middle
    expect(ends.a.y).toBeCloseTo(a.y + a.h / 2, 5);
    expect(ends.b.x).toBeLessThan(items.get('b')!.x + items.get('b')!.w / 2);
    expect(linkEnds(link('x', 'a', 'gone'), items)).toBeNull();
  });
});

describe('where a line meets an item', () => {
  it('leaves a rectangle on the side that faces the other end, and a diagonal one through the nearer side', () => {
    const r = { x: 0, y: 0, w: 100, h: 50 };
    expect(edgePoint(r, { x: 500, y: 25 })).toEqual({ x: 100, y: 25 });
    expect(edgePoint(r, { x: 50, y: -300 })).toEqual({ x: 50, y: 0 });
    const diagonal = edgePoint(r, { x: 300, y: 300 });
    expect(diagonal.y).toBeCloseTo(50, 5); // it hits the bottom first
    expect(diagonal.x).toBeLessThan(100);
  });
  it('leaves an ellipse on its curve', () => {
    const e = { x: 0, y: 0, w: 200, h: 100, ellipse: true };
    const p = edgePoint(e, { x: 1000, y: 50 });
    expect(p.x).toBeCloseTo(200, 5);
    const q = edgePoint(e, { x: 1000, y: 1000 });
    expect(((q.x - 100) / 100) ** 2 + ((q.y - 50) / 50) ** 2).toBeCloseTo(1, 5);
  });
  it('does not fail when the point is the middle', () => {
    expect(edgePoint({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
  });
});

describe('taking things away', () => {
  it('takes a shape away with its lines and comments, and leaves the rest', () => {
    const known = new Set(['a', 'b']);
    let f = addLink(two(), known, link('l1', 'a', 'b'));
    f = addComment(f, comment('c1', { targetId: 'a' }));
    f = addComment(f, comment('c2', { targetId: 'b' }));
    const after = removeItem(f, 'a');
    expect(after.shapes.map(s => s.id)).toEqual(['b']);
    expect(after.links).toEqual([]);
    expect(after.comments.map(c => c.id)).toEqual(['c2']);
  });
  it('takes away one line or one comment without touching anything else, and also clears what hung on an idea of the tree', () => {
    const f = addComment(addLink(two(), new Set(['a', 'b', 'idea1']), link('l1', 'a', 'idea1')), comment('c1', { targetId: 'idea1' }));
    expect(removeItem(f, 'l1').links).toEqual([]);
    expect(removeItem(f, 'l1').shapes).toHaveLength(2);
    expect(removeItem(f, 'c1').comments).toEqual([]);
    const gone = removeItem(f, 'idea1'); // an idea removed from the tree: what pointed at it goes
    expect(gone.links).toEqual([]);
    expect(gone.comments).toEqual([]);
  });
});

describe('comments', () => {
  it('adds a comment with its words trimmed, and refuses an empty one', () => {
    const f = addComment(EMPTY_FREE, comment('c1', { text: '  Check this  ' }));
    expect(f.comments[0].text).toBe('Check this');
    expect(addComment(EMPTY_FREE, comment('c2', { text: '   ' }))).toBe(EMPTY_FREE);
  });
  it('cuts a very long comment and stops at the limit', () => {
    expect(addComment(EMPTY_FREE, comment('c', { text: 'y'.repeat(3000) })).comments[0].text).toHaveLength(1000);
    const full: FreeDoc = { ...EMPTY_FREE, comments: Array.from({ length: MAX_COMMENTS }, (_, i) => comment(`c${i}`)) };
    expect(addComment(full, comment('more'))).toBe(full);
  });
  it('edits the words and notes when, keeps who wrote it, and ignores an empty edit', () => {
    const f = addComment(EMPTY_FREE, comment('c1'));
    const edited = editComment(f, 'c1', ' Better words ', '2026-11-24T12:00:00Z');
    expect(edited.comments[0]).toMatchObject({ text: 'Better words', editedAt: '2026-11-24T12:00:00Z', author: 'Asha', at: '2026-11-24T10:00:00Z' });
    expect(editComment(f, 'c1', '  ', 'x')).toBe(f);
  });
  it('marks a comment as resolved and open again', () => {
    const f = toggleResolved(addComment(EMPTY_FREE, comment('c1')), 'c1');
    expect(f.comments[0].resolved).toBe(true);
    expect(toggleResolved(f, 'c1').comments[0].resolved).toBe(false);
  });
});

describe('reading what was stored', () => {
  it('keeps well formed items and drops the rest, whatever was stored', () => {
    const f = readFree({
      shapes: [{ id: 's1', kind: 'box', x: 1, y: 2, w: 100, h: 40, text: 'ok' }, { id: 's2', kind: 'star', x: 1, y: 2, w: 1, h: 1, text: 'x' }, { id: 's3', kind: 'box', x: 'a', y: 2, w: 1, h: 1, text: 'x' }, null, 7],
      links: [{ id: 'l1', from: 'a', to: 'b', arrow: true }, { id: 'l2', from: 'a', to: 'a' }, { id: 5 }],
      comments: [{ id: 'c1', text: 'hi', author: 'A', at: 'now', x: 0, y: 0 }, { id: 'c2', text: '  ', author: 'A', at: 'now', x: 0, y: 0 }],
    });
    expect(f.shapes.map(s => s.id)).toEqual(['s1']);
    expect(f.links.map(l => l.id)).toEqual(['l1']);
    expect(f.comments.map(c => c.id)).toEqual(['c1']);
  });
  it('makes a shape at least readable, cuts a long text, and does not trust a flag that is not true or false', () => {
    const f = readFree({ shapes: [{ id: 's', kind: 'note', x: 0, y: 0, w: 1, h: 1, text: 'z'.repeat(2000) }], links: [{ id: 'l', from: 'a', to: 'b', arrow: 'yes', dashed: 1 }] });
    expect([f.shapes[0].w, f.shapes[0].h, f.shapes[0].text.length]).toEqual([MIN_W, MIN_H, 500]);
    expect(f.links[0]).toMatchObject({ arrow: false, dashed: false });
  });
  it('gives an empty layer for nothing or for something that is not a list', () => {
    expect(readFree({})).toEqual(EMPTY_FREE);
    expect(readFree({ shapes: 'no', links: {}, comments: 3 })).toEqual(EMPTY_FREE);
  });
});

describe('the head of an arrow', () => {
  it('has its tip on the end of the line and its other two corners behind it, either side of the line', () => {
    const [tip, c1, c2] = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }).split(' ').map(p => p.split(',').map(Number));
    expect(tip).toEqual([100, 0]);
    expect(c1[0]).toBeLessThan(100);
    expect(c2[0]).toBeLessThan(100);
    expect(c1[1]).toBeCloseTo(-c2[1], 5); // one each side
    expect(Math.abs(c1[1])).toBeGreaterThan(0);
  });
  it('turns with the line', () => {
    const [tip, c1] = arrowHead({ x: 0, y: 0 }, { x: 0, y: 50 }).split(' ').map(p => p.split(',').map(Number));
    expect(tip).toEqual([0, 50]);
    expect(c1[1]).toBeLessThan(50);
  });
});

describe('breaking a text into lines', () => {
  it('keeps a short text on one line and breaks a long one at spaces, never over the width', () => {
    expect(wrapLines('Hello there', 400, 14)).toEqual(['Hello there']);
    const lines = wrapLines('one two three four five six seven eight', 100, 14); // about 12 characters a line
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.every(l => l.length <= 12)).toBe(true);
    expect(lines.join(' ')).toBe('one two three four five six seven eight');
  });
  it('keeps the line breaks that were typed, including an empty line', () => {
    expect(wrapLines('a\n\nb', 400, 14)).toEqual(['a', '', 'b']);
  });
  it('breaks a word that is longer than a line, and gives one empty line for an empty text', () => {
    expect(wrapLines('x'.repeat(30), 100, 14).every(l => l.length <= 12)).toBe(true);
    expect(wrapLines('', 100, 14)).toEqual(['']);
  });
});

describe('where a comment is pinned', () => {
  it('is the top right corner of what it is about, and the spot it was left at when it is about nothing', () => {
    const items = new Map([['a', { x: 10, y: 20, w: 100, h: 50 }]]);
    expect(pinAt(comment('c', { targetId: 'a' }), items)).toEqual({ x: 110, y: 20 });
    expect(pinAt(comment('c', { targetId: null, x: 7, y: 9 }), items)).toEqual({ x: 7, y: 9 });
    expect(pinAt(comment('c', { targetId: 'gone', x: 7, y: 9 }), items)).toEqual({ x: 7, y: 9 }); // what it was about has gone
  });
});

describe('joining two areas', () => {
  it('is the box around both, and either one alone when the other is missing or empty', () => {
    expect(mergeBounds({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: -5, w: 10, h: 10 })).toEqual({ x: 0, y: -5, w: 30, h: 15 });
    expect(mergeBounds({ x: 1, y: 2, w: 3, h: 4 }, null)).toEqual({ x: 1, y: 2, w: 3, h: 4 });
    expect(mergeBounds({ x: 0, y: 0, w: 0, h: 0 }, { x: 5, y: 5, w: 10, h: 10 })).toEqual({ x: 5, y: 5, w: 10, h: 10 });
  });
});

describe('the space the shapes cover', () => {
  it('is the box around all of them, or nothing when there are none', () => {
    expect(freeBounds([])).toBeNull();
    const b = freeBounds(two().shapes)!;
    expect(b.x).toBe(20);
    expect(b.w).toBeGreaterThan(300);
  });
});
