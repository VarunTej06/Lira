import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, useState } from 'react';
import { addChild, newMap, type MindNode } from '../../utils/mindmap';
import { byText, cleanup, mount, q, qa, settle } from '../../test/render';
import { MIND_COLORS } from '../../theme/palette';
import { EMPTY_FREE, addShape, newShape, type FreeDoc } from '../../utils/mindFree';
import { MindMapCanvas } from './MindMapCanvas';
import type { Tool } from './useFreeTools';

afterEach(cleanup);

const start = (): MindNode[] => addChild(addChild(newMap('m', 'Plan', 'now', 'r').nodes, 'r', 'a', 'Alpha'), 'a', 'a1', 'Alpha one');

/** The canvas held by a small parent, as the page holds it, so that edits come back as the next nodes and the next shapes. */
function Harness({ initial = start(), initialFree = EMPTY_FREE, initialTool = 'select', query = '', readOnly = false, canUndo = true, canRedo = true, spy }: { initial?: MindNode[]; initialFree?: FreeDoc; initialTool?: Tool; query?: string; readOnly?: boolean; canUndo?: boolean; canRedo?: boolean; spy?: { changes: MindNode[][]; frees: FreeDoc[]; styles: string[]; undo: () => void; redo: () => void; select: (id: string | null) => void } }) {
  const [nodes, setNodes] = useState(initial);
  const [free, setFree] = useState(initialFree);
  const [tool, setTool] = useState<Tool>(initialTool);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  return <MindMapCanvas nodes={nodes} readOnly={readOnly} query={query} selected={selected} editing={editing} onEditing={setEditing} canUndo={canUndo} canRedo={canRedo}
    free={free} onFree={f => { spy?.frees.push(f); setFree(f); }} tool={tool} onTool={setTool} onStyle={k => spy?.styles.push(k)} author="Asha"
    onChange={n => { spy?.changes.push(n); setNodes(n); }} onSelect={id => { spy?.select(id); setSelected(id); }} onUndo={() => spy?.undo()} onRedo={() => spy?.redo()} />;
}
const spy = () => ({ changes: [] as MindNode[][], frees: [] as FreeDoc[], styles: [] as string[], undo: vi.fn(), redo: vi.fn(), select: vi.fn() });
const surface = () => q<HTMLElement>('[aria-label="Storyboard"]')!;
const box = (text: string) => qa('g[data-node-id]').find(g => g.textContent?.includes(text))!;
const press = async (key: string, init: KeyboardEventInit = {}) => { await act(async () => { surface().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init })); }); };
const pick = async (text: string) => { await act(async () => { box(text).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 })); }); };
const labels = () => qa('g[data-node-id] text').map(t => t.textContent);

describe('the storyboard drawing', () => {
  it('draws every idea, and a line to each from its parent', () => {
    mount(<Harness />);
    expect(labels()).toEqual(expect.arrayContaining(['Plan', 'Alpha', 'Alpha one']));
    expect(qa('svg.touch-none path').length).toBe(2);
  });

  it('selects an idea on a click', async () => {
    const s = spy();
    mount(<Harness spy={s} />);
    await pick('Alpha');
    expect(s.select).toHaveBeenLastCalledWith(expect.any(String));
  });

  it('Tab adds an idea under the selected one and opens it for typing; Enter in the box keeps the text', async () => {
    const s = spy();
    mount(<Harness spy={s} />);
    await pick('Alpha one');
    await press('Tab');
    expect(s.changes.at(-1)).toHaveLength(4);
    expect(s.changes.at(-1)!.at(-1)).toMatchObject({ text: 'New idea', parentId: 'a1' });
    const input = q<HTMLInputElement>('input[aria-label="Idea text"]')!;
    expect(input.value).toBe('New idea');
    input.value = 'Typed';
    await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(s.changes.at(-1)!.at(-1)!.text).toBe('Typed');
    expect(q('input[aria-label="Idea text"]')).toBeNull();
  });

  it('Escape in the box keeps the old text', async () => {
    const s = spy();
    mount(<Harness spy={s} />);
    await pick('Alpha one');
    await press('F2');
    const input = q<HTMLInputElement>('input[aria-label="Idea text"]')!;
    input.value = 'Changed my mind';
    await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(s.changes).toEqual([]);
  });

  it('Enter adds a sibling, but not for the central idea', async () => {
    const s = spy();
    mount(<Harness spy={s} />);
    await pick('Plan');
    await press('Enter');
    expect(s.changes).toEqual([]);
    await pick('Alpha');
    await press('Enter');
    expect(s.changes.at(-1)!.find(n => n.text === 'New idea')).toMatchObject({ parentId: 'r' });
  });

  it('Delete removes the idea with its branch and selects its parent, and never removes the central idea', async () => {
    const s = spy();
    mount(<Harness spy={s} />);
    await pick('Plan');
    await press('Delete');
    expect(s.changes).toEqual([]);
    await pick('Alpha');
    await press('Delete');
    expect(s.changes.at(-1)!.map(n => n.id)).toEqual(['r']);
    expect(s.select).toHaveBeenLastCalledWith('r');
  });

  it('Space folds an idea, which hides what is under it, and the little button unfolds it', async () => {
    mount(<Harness />);
    await pick('Alpha');
    await press(' ');
    expect(labels()).not.toContain('Alpha one');
    await act(async () => { q('[aria-label="Unfold"]')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    expect(labels()).toContain('Alpha one');
  });

  it('moves the selection with the arrows', async () => {
    const s = spy();
    mount(<Harness spy={s} />);
    await pick('Plan');
    await press('ArrowRight');
    expect(s.select).toHaveBeenLastCalledWith('a');
    await press('ArrowRight');
    expect(s.select).toHaveBeenLastCalledWith('a1');
    await press('ArrowLeft');
    expect(s.select).toHaveBeenLastCalledWith('a');
  });

  it('asks for undo and redo with Ctrl+Z, Ctrl+Shift+Z and Ctrl+Y', async () => {
    const s = spy();
    mount(<Harness spy={s} />);
    await press('z', { ctrlKey: true });
    expect(s.undo).toHaveBeenCalledTimes(1);
    await press('z', { ctrlKey: true, shiftKey: true });
    await press('y', { ctrlKey: true });
    expect(s.redo).toHaveBeenCalledTimes(2);
  });

  it('changes nothing when it is read only, though the arrows still move about', async () => {
    const s = spy();
    mount(<Harness readOnly spy={s} />);
    await pick('Alpha');
    for (const k of ['Tab', 'Enter', 'Delete', ' ', 'F2']) await press(k);
    expect(s.changes).toEqual([]);
    expect(q('input[aria-label="Idea text"]')).toBeNull();
    await press('ArrowRight');
    expect(s.select).toHaveBeenLastCalledWith('a1');
  });

  it('rings the ideas a search finds, and none when it is empty', () => {
    mount(<Harness query="alpha" />);
    expect(qa('rect[stroke-dasharray]').length).toBe(2);
    cleanup();
    mount(<Harness query="" />);
    expect(qa('rect[stroke-dasharray]').length).toBe(0);
  });

  it('draws each main branch in its own colour with its twigs in the same, and the central idea as a card', () => {
    mount(<Harness initial={addChild(start(), 'r', 'b', 'Beta')} />);
    const strokes = qa('svg.touch-none path').map(p => p.getAttribute('stroke'));
    expect(strokes[0]).toBe(MIND_COLORS[0]); // Alpha
    expect(strokes[1]).toBe(MIND_COLORS[0]); // Alpha one follows its branch
    expect(strokes[2]).toBe(MIND_COLORS[1]); // Beta
    expect(qa('g[data-node-id] rect').filter(r => r.getAttribute('rx') === '14')).toHaveLength(1);
  });

  it('puts the second branch on the left of the central idea', () => {
    mount(<Harness initial={addChild(start(), 'r', 'b', 'Beta')} />);
    const x = (text: string) => Number(/translate\(([-\d.]+)/.exec(box(text).getAttribute('transform')!)![1]);
    expect(x('Alpha')).toBeGreaterThan(0);
    expect(x('Beta')).toBeLessThan(0);
  });

  it('shows the zoom, and has undo and redo in the corner that ask the page and are off when there is nothing to undo or redo', async () => {
    const s = spy();
    mount(<Harness spy={s} />);
    expect(q('[aria-label="Zoom"]')!.textContent).toBe('100%');
    await act(async () => { q<HTMLButtonElement>('button[aria-label="Undo"]')!.click(); q<HTMLButtonElement>('button[aria-label="Redo"]')!.click(); });
    expect(s.undo).toHaveBeenCalledTimes(1);
    expect(s.redo).toHaveBeenCalledTimes(1);
    cleanup();
    mount(<Harness canUndo={false} canRedo={false} />);
    expect(q<HTMLButtonElement>('button[aria-label="Undo"]')!.disabled).toBe(true);
    expect(q<HTMLButtonElement>('button[aria-label="Redo"]')!.disabled).toBe(true);
  });

  it('opens a list of the keys from the help button, and closes it again', async () => {
    mount(<Harness />);
    await act(async () => { q<HTMLButtonElement>('button[aria-label="Keys and mouse"]')!.click(); });
    expect(q('[role="dialog"][aria-label="Keys and mouse"]')!.textContent).toContain('Tab');
    await act(async () => { q<HTMLButtonElement>('button[aria-label="Keys and mouse"]')!.click(); });
    expect(q('[role="dialog"][aria-label="Keys and mouse"]')).toBeNull();
  });

  it('zooms and fits with its buttons without failing', async () => {
    mount(<Harness />);
    for (const name of ['Zoom in', 'Zoom out', 'Fit to screen']) await act(async () => { q<HTMLButtonElement>(`button[aria-label="${name}"]`)!.click(); });
    expect(qa('g[data-node-id]').length).toBe(3);
  });
});

const shapeEl = (text: string) => qa('g[data-shape-id]').find(g => g.textContent?.includes(text))!;
const withShapes = (): FreeDoc => addShape(addShape(EMPTY_FREE, { ...newShape('box', 'sa', 200, 300), text: 'First box' }), { ...newShape('ellipse', 'sb', 500, 300), text: 'Second' });
const onBoard = async (x = 300, y = 300) => { await act(async () => { q('svg.touch-none')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y })); }); };
const pressShape = async (text: string) => { await act(async () => { shapeEl(text).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 })); }); };

describe('zooming the board and not the page', () => {
  const wheel = (init: WheelEventInit) => { const e = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init }); surface().dispatchEvent(e); return e; };

  it('keeps a pinch from zooming the whole page (it arrives as a wheel turn with Ctrl held), and zooms the board in', async () => {
    mount(<Harness />);
    expect(q('[aria-label="Zoom"]')!.textContent).toBe('100%');
    let event!: WheelEvent;
    await act(async () => { event = wheel({ ctrlKey: true, deltaY: -40 }); });
    expect(event.defaultPrevented).toBe(true);
    expect(parseInt(q('[aria-label="Zoom"]')!.textContent!, 10)).toBeGreaterThan(100);
  });

  it('zooms out for the other way, and in steps with a plain wheel too, never letting the page scroll or zoom', async () => {
    mount(<Harness />);
    let a!: WheelEvent; let b!: WheelEvent;
    await act(async () => { a = wheel({ ctrlKey: true, deltaY: 40 }); });
    expect(parseInt(q('[aria-label="Zoom"]')!.textContent!, 10)).toBeLessThan(100);
    await act(async () => { b = wheel({ deltaY: -100 }); });
    expect(a.defaultPrevented && b.defaultPrevented).toBe(true);
  });

  it('keeps Safari\'s own pinch gesture from zooming the page', () => {
    mount(<Harness />);
    for (const name of ['gesturestart', 'gesturechange']) {
      const e = new Event(name, { bubbles: true, cancelable: true });
      surface().dispatchEvent(e);
      expect(e.defaultPrevented, name).toBe(true);
    }
  });
});

describe('adding ideas', () => {
  it('adds an idea under the selected one from the small plus at its end, and opens it for typing', async () => {
    const s = spy();
    mount(<Harness spy={s} />);
    await pick('Alpha');
    await act(async () => { q('[aria-label="Add an idea under this one"]')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    expect(s.changes.at(-1)!.find(n => n.text === 'New idea')).toMatchObject({ parentId: 'a' });
    await settle(10);
    expect(q('input[aria-label="Idea text"]')).not.toBeNull();
  });
  it('shows no plus for an idea that is not selected, or when it is read only', async () => {
    mount(<Harness />);
    expect(q('[aria-label="Add an idea under this one"]')).toBeNull();
    cleanup();
    mount(<Harness readOnly />);
    await pick('Alpha');
    expect(q('[aria-label="Add an idea under this one"]')).toBeNull();
  });
});

describe('shapes on the board', () => {
  it('puts a shape down where the board is clicked with a shape tool, selects it, opens it for typing, and goes back to selecting', async () => {
    const s = spy();
    mount(<Harness spy={s} initialTool="note" />);
    expect(q('[role="status"]')!.textContent).toContain('sticky note');
    await onBoard();
    await settle(10);
    expect(s.frees.at(-1)!.shapes).toHaveLength(1);
    expect(s.frees.at(-1)!.shapes[0]).toMatchObject({ kind: 'note', text: 'Note' });
    expect(q('textarea[aria-label="Text of the shape"]')).not.toBeNull();
    expect(q('[role="status"]')).toBeNull(); // the tool is done
  });

  it('draws boxes, ellipses, notes and text, each with its words, and makes the selected one show its resize handle', async () => {
    mount(<Harness initialFree={withShapes()} />);
    expect(qa('g[data-shape-id]')).toHaveLength(2);
    expect(shapeEl('First box').querySelector('rect')).not.toBeNull();
    expect(shapeEl('Second').querySelector('ellipse')).not.toBeNull();
    expect(q('rect[data-resize]')).toBeNull();
    await pressShape('First box');
    expect(q('rect[data-resize="sa"]')).not.toBeNull();
  });

  it('writes in a shape on a double click, keeps the words when Ctrl+Enter or leaving, and keeps the old ones on Escape', async () => {
    const s = spy();
    mount(<Harness initialFree={withShapes()} spy={s} />);
    await act(async () => { shapeEl('First box').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
    let box = q<HTMLTextAreaElement>('textarea[aria-label="Text of the shape"]')!;
    box.value = 'Changed';
    await act(async () => { box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })); });
    expect(s.frees.at(-1)!.shapes[0].text).toBe('Changed');
    await act(async () => { shapeEl('Changed').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
    box = q<HTMLTextAreaElement>('textarea[aria-label="Text of the shape"]')!;
    box.value = 'Never kept';
    const before = s.frees.length;
    await act(async () => { box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(s.frees.length).toBe(before);
  });

  it('moves a selected shape with the arrow keys, ten at a time and one with Shift, and deletes it with Delete', async () => {
    const s = spy();
    mount(<Harness initialFree={withShapes()} spy={s} />);
    await pressShape('First box');
    const x0 = withShapes().shapes[0].x;
    await press('ArrowRight');
    expect(s.frees.at(-1)!.shapes[0].x).toBe(x0 + 10);
    await press('ArrowLeft', { shiftKey: true });
    expect(s.frees.at(-1)!.shapes[0].x).toBe(x0 + 9);
    await press('Delete');
    expect(s.frees.at(-1)!.shapes.map(sh => sh.id)).toEqual(['sb']);
  });

  it('does nothing to shapes when it is read only', async () => {
    const s = spy();
    mount(<Harness initialFree={withShapes()} readOnly initialTool="box" spy={s} />);
    await onBoard();
    await pressShape('First box');
    await press('Delete');
    expect(s.frees).toEqual([]);
  });
});

describe('lines and arrows', () => {
  it('joins two shapes with a line: the first click starts it, the second ends it, and the tool is done', async () => {
    const s = spy();
    mount(<Harness initialFree={withShapes()} initialTool="arrow" spy={s} />);
    expect(q('[role="status"]')!.textContent).toContain('start at');
    await pressShape('First box');
    expect(q('[role="status"]')!.textContent).toContain('should end at');
    await pressShape('Second');
    expect(s.frees.at(-1)!.links).toEqual([expect.objectContaining({ from: 'sa', to: 'sb', arrow: true })]);
    expect(q('[role="status"]')).toBeNull();
    expect(qa('g[data-link-id] polygon')).toHaveLength(1); // the arrowhead
  });

  it('joins a shape to an idea of the map, with a plain line when the line tool is used', async () => {
    const s = spy();
    mount(<Harness initialFree={withShapes()} initialTool="line" spy={s} />);
    await pressShape('First box');
    await pick('Alpha');
    expect(s.frees.at(-1)!.links[0]).toMatchObject({ from: 'sa', to: 'a', arrow: false });
    expect(qa('g[data-link-id] polygon')).toHaveLength(0);
  });

  it('stops drawing a line on Escape, joining nothing', async () => {
    const s = spy();
    mount(<Harness initialFree={withShapes()} initialTool="line" spy={s} />);
    await pressShape('First box');
    await press('Escape');
    expect(q('[role="status"]')).toBeNull();
    await pressShape('Second');
    expect(s.frees).toEqual([]);
  });

  it('selects a line with a click and deletes it with Delete, keeping the shapes', async () => {
    const s = spy();
    const free = { ...withShapes(), links: [{ id: 'l1', from: 'sa', to: 'sb', arrow: false }] };
    mount(<Harness initialFree={free} spy={s} />);
    await act(async () => { q('g[data-link-id]')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    await press('Delete');
    expect(s.frees.at(-1)).toMatchObject({ links: [], shapes: [expect.anything(), expect.anything()] });
  });
});

describe('comments', () => {
  it('opens a small box where the board is clicked with the comment tool, and pins the comment with its author', async () => {
    const s = spy();
    mount(<Harness initialTool="comment" spy={s} />);
    await onBoard(400, 200);
    const box = q<HTMLTextAreaElement>('textarea[aria-label="Write a comment"]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box, 'Check the budget'); box.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { byText('button', 'Comment')!.click(); });
    const made = s.frees.at(-1)!.comments;
    expect(made).toEqual([expect.objectContaining({ text: 'Check the budget', author: 'Asha', targetId: null })]);
    expect(qa('g[data-comment-id]')).toHaveLength(1);
    expect(q('section[aria-label="Comment"]')!.textContent).toContain('Check the budget'); // the new pin is selected, so its card is open
  });

  it('pins a comment to an idea or a shape, and moves with it', async () => {
    const s = spy();
    mount(<Harness initialFree={withShapes()} initialTool="comment" spy={s} />);
    await pressShape('Second');
    await act(async () => { const box = q<HTMLTextAreaElement>('textarea[aria-label="Write a comment"]')!; Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box, 'About this'); box.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { byText('button', 'Comment')!.click(); });
    expect(s.frees.at(-1)!.comments[0].targetId).toBe('sb');
  });

  it('shows a comment on its pin, edits it with the pencil, resolves it, and deletes it', async () => {
    const s = spy();
    const free = { ...EMPTY_FREE, comments: [{ id: 'c1', targetId: null, x: 10, y: 10, text: 'First words', author: 'Maya', at: '2026-11-24T10:00:00Z' }] };
    mount(<Harness initialFree={free} spy={s} />);
    expect(q('section[aria-label="Comment"]')).toBeNull();
    await act(async () => { q('g[data-comment-id]')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    expect(q('section[aria-label="Comment"]')!.textContent).toContain('Maya');
    await act(async () => { q<HTMLButtonElement>('button[aria-label="Edit the comment text"]')!.click(); });
    const box = q<HTMLTextAreaElement>('textarea[aria-label="Edit the comment"]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box, 'Better words'); box.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { byText('button', 'Save')!.click(); });
    expect(s.frees.at(-1)!.comments[0]).toMatchObject({ text: 'Better words', author: 'Maya' });
    expect(s.frees.at(-1)!.comments[0].editedAt).toBeTruthy();
    expect(q('section[aria-label="Comment"]')!.textContent).toContain('(edited)');
    await act(async () => { q<HTMLButtonElement>('button[aria-label="Mark the comment as resolved"]')!.click(); });
    expect(s.frees.at(-1)!.comments[0].resolved).toBe(true);
    await act(async () => { q<HTMLButtonElement>('button[aria-label="Delete the comment"]')!.click(); });
    expect(s.frees.at(-1)!.comments).toEqual([]);
    expect(q('g[data-comment-id]')).toBeNull();
  });

  it('writes nothing when the comment is left empty or the box is cancelled', async () => {
    const s = spy();
    mount(<Harness initialTool="comment" spy={s} />);
    await onBoard();
    expect(byText<HTMLButtonElement>('button', 'Comment')!.disabled).toBe(true);
    await act(async () => { byText('button', 'Cancel')!.click(); });
    expect(s.frees).toEqual([]);
    expect(q('form[aria-label="New comment"]')).toBeNull();
  });
});

describe('bold, italic and underline from the keys', () => {
  it('asks the page for each style of the selected idea or shape with Ctrl+B, Ctrl+I and Ctrl+U, and not while typing', async () => {
    const s = spy();
    mount(<Harness spy={s} initialFree={withShapes()} />);
    await pick('Alpha');
    await press('b', { ctrlKey: true }); await press('i', { ctrlKey: true }); await press('u', { ctrlKey: true });
    expect(s.styles).toEqual(['bold', 'italic', 'underline']);
    await press('F2');
    await act(async () => { q('input[aria-label="Idea text"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true })); });
    expect(s.styles).toHaveLength(3);
  });
  it('draws a styled idea and a styled shape with the style', () => {
    const nodes = start().map(n => (n.id === 'a' ? { ...n, bold: true, italic: true, underline: true } : n));
    const free = { ...withShapes(), shapes: withShapes().shapes.map(sh => (sh.id === 'sa' ? { ...sh, bold: true, underline: true } : sh)) };
    mount(<Harness initial={nodes} initialFree={free} />);
    const idea = box('Alpha').querySelector('text')!;
    expect([idea.getAttribute('font-weight'), idea.getAttribute('font-style'), idea.getAttribute('text-decoration')]).toEqual(['700', 'italic', 'underline']);
    const sh = shapeEl('First box').querySelector('text')!;
    expect([sh.getAttribute('font-weight'), sh.getAttribute('text-decoration')]).toEqual(['700', 'underline']);
  });
});
