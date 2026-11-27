import { describe, expect, it } from 'vitest';
import {
  addComment, addLink, arrowHead, mergeBounds, pinAt, addShape, bendFor, edgePoint, editComment, EMPTY_FREE, FREE, freeBounds, HANDLES, linkShape, MAX_COMMENTS, MAX_LINKS, MAX_SHAPES, MIN_H, MIN_W, moveShape, newShape,
  readFree, removeItem, resizeFrom, setLinkEnd, toggleResolved, updateLink, updateShape, wrapLines, type FreeDoc, type Link, type MindComment,
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
    const ends = linkShape(f.links[0], items)!;
    const a = items.get('a')!;
    expect(ends.a.x).toBeCloseTo(a.x + a.w, 5); // the right edge of the box, level with its middle
    expect(ends.a.y).toBeCloseTo(a.y + a.h / 2, 5);
    expect(ends.b.x).toBeLessThan(items.get('b')!.x + items.get('b')!.w / 2);
    expect(linkShape(link('x', 'a', 'gone'), items)).toBeNull();
  });
});

describe('bent lines and lines with a free end', () => {
  const items = new Map([['a', { x: 0, y: 0, w: 100, h: 50 }], ['b', { x: 400, y: 0, w: 100, h: 50 }]]);
  const base = (over: Partial<Link> = {}): Link => ({ id: 'l', from: 'a', to: 'b', arrow: true, ...over });

  it('is straight when it has no bend, with its middle halfway between its ends', () => {
    const s = linkShape(base(), items)!;
    expect(s.c).toBeNull();
    expect(s.d).toMatch(/^M[\d. -]+L[\d. -]+$/);
    expect(s.mid).toEqual({ x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 });
  });
  it('is a curve when it has a bend: the middle is pushed to one side, the other way for a negative bend, and the ends turn towards the curve', () => {
    const up = linkShape(base({ bend: 80 }), items)!;
    const down = linkShape(base({ bend: -80 }), items)!;
    expect(up.d).toContain('Q');
    expect(Math.sign(up.mid.y - 25)).toBe(-Math.sign(down.mid.y - 25)); // either side of the straight line
    expect(Math.abs(up.mid.y - 25)).toBeGreaterThan(50);
    expect(up.a.y).not.toBe(25); // it leaves the item at an angle, towards the curve
    expect(up.tail).toEqual(up.c); // and the arrowhead points along the end of the curve
  });
  it('finds the bend that sends the middle of the line through a point dragged to, and calls a small bend straight', () => {
    const l = base();
    const bend = bendFor(l, items, { x: 250, y: 25 - 100 });
    expect(Math.abs(bend)).toBeCloseTo(100, 0);
    const back = linkShape({ ...l, bend }, items)!;
    expect(back.mid.y).toBeLessThan(25 - 60); // it now bulges the way it was dragged
    expect(bendFor(l, items, { x: 250, y: 25 + 3 })).toBe(0);
  });
  it('lets an end rest on a place of its own, and joins an item to such a place', () => {
    const l = base({ to: FREE, toAt: { x: 700, y: 25 } });
    const s = linkShape(l, items)!;
    expect(s.b).toEqual({ x: 700, y: 25 });
    expect(s.a.x).toBeCloseTo(100, 5); // it leaves the right edge of the first item
    const both = linkShape({ id: 'x', from: FREE, to: FREE, arrow: false, fromAt: { x: 0, y: 0 }, toAt: { x: 30, y: 40 } }, items)!;
    expect([both.a, both.b]).toEqual([{ x: 0, y: 0 }, { x: 30, y: 40 }]);
  });
  it('gives nothing for a line whose item is gone, but keeps one whose end is a place of its own', () => {
    expect(linkShape(base({ to: 'gone' }), items)).toBeNull();
    expect(linkShape(base({ from: FREE, fromAt: { x: 5, y: 5 } }), items)).not.toBeNull();
  });
  it('adds a line that starts or ends on empty space, and still refuses an end that is not there or a pair joined already', () => {
    const known = new Set(['a', 'b']);
    const f = addLink(EMPTY_FREE, known, { id: 'l1', from: 'a', to: FREE, toAt: { x: 9, y: 9 }, arrow: true });
    expect(f.links).toHaveLength(1);
    expect(addLink(f, known, { id: 'l2', from: FREE, to: FREE, fromAt: { x: 1, y: 1 }, toAt: { x: 2, y: 2 }, arrow: false }).links).toHaveLength(2);
    expect(addLink(f, known, { id: 'l3', from: FREE, to: 'b', arrow: false })).toBe(f); // a free end needs its place
    expect(addLink(f, known, { id: 'l4', from: 'a', to: FREE, arrow: false })).toBe(f);
    expect(addLink(f, known, { id: 'l5', from: 'ghost', to: FREE, toAt: { x: 0, y: 0 }, arrow: false })).toBe(f);
  });
  it('moves an end onto another item or to a place, keeps the other end, and refuses to join an item to itself', () => {
    const known = new Set(['a', 'b', 'c']);
    const f = addLink(EMPTY_FREE, known, base());
    const onC = setLinkEnd(f, 'l', 'to', { id: 'c' });
    expect(onC.links[0]).toMatchObject({ from: 'a', to: 'c' });
    const free = setLinkEnd(f, 'l', 'to', { at: { x: 10.4, y: 20.6 } });
    expect(free.links[0]).toMatchObject({ from: 'a', to: FREE, toAt: { x: 10, y: 21 } });
    const back = setLinkEnd(free, 'l', 'to', { id: 'b' });
    expect(back.links[0].toAt).toBeUndefined();
    expect(setLinkEnd(f, 'l', 'to', { id: 'a' })).toEqual(f); // an item joined to itself
    expect(setLinkEnd(f, 'nope', 'to', { id: 'c' })).toEqual(f);
  });
  it('reads a stored bend and free end back, and drops a free end with no place or a bend that is not a number', () => {
    const f = readFree({ links: [
      { id: 'a', from: 'x', to: 'y', arrow: true, bend: 40 }, { id: 'b', from: 'x', to: '', arrow: true, toAt: { x: 1, y: 2 } }, { id: 'c', from: 'x', to: '', arrow: true },
      { id: 'd', from: 'x', to: 'y', arrow: true, bend: 'big' }, { id: 'e', from: 'x', to: 'y', arrow: true, bend: 99999 }, { id: 'f', from: '', to: '', arrow: false, fromAt: { x: 0, y: 0 }, toAt: { x: 5, y: 5 } },
    ] });
    expect(f.links.map(l => l.id)).toEqual(['a', 'b', 'd', 'e', 'f']);
    expect(f.links[0].bend).toBe(40);
    expect(f.links[2].bend).toBeUndefined();
    expect(f.links[3].bend).toBe(1000);
    expect(f.links[1].toAt).toEqual({ x: 1, y: 2 });
  });
});

describe('resizing from a handle', () => {
  const r = { x: 100, y: 100, w: 200, h: 100 };
  it('moves the side that is held and keeps the opposite side where it is', () => {
    expect(resizeFrom(r, { x: 1, y: 1 }, 30, 20)).toEqual({ x: 100, y: 100, w: 230, h: 120 });
    expect(resizeFrom(r, { x: -1, y: -1 }, -30, -20)).toEqual({ x: 70, y: 80, w: 230, h: 120 }); // pulled up and to the left: bigger, and the far corner stays
    expect(resizeFrom(r, { x: 0, y: 1 }, 99, 10)).toEqual({ x: 100, y: 100, w: 200, h: 110 }); // an edge handle changes one side only
    expect(resizeFrom(r, { x: -1, y: 0 }, 50, 99)).toEqual({ x: 150, y: 100, w: 150, h: 100 });
  });
  it('never gets smaller than a readable size, and then the held side stops at the other', () => {
    const small = resizeFrom(r, { x: -1, y: -1 }, 500, 500);
    expect([small.w, small.h]).toEqual([48, 28]);
    expect([small.x + small.w, small.y + small.h]).toEqual([300, 200]); // the far corner did not move
  });
  it('has eight handles, one for each corner and side', () => {
    expect(HANDLES).toHaveLength(8);
    expect(new Set(HANDLES.map(h => `${h.x},${h.y}`)).size).toBe(8);
    expect(HANDLES.some(h => h.x === 0 && h.y === 0)).toBe(false);
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
