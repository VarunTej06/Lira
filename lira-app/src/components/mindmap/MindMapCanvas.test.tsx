import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, useState } from 'react';
import { addChild, newMap, type MindNode } from '../../utils/mindmap';
import { cleanup, mount, q, qa } from '../../test/render';
import { MindMapCanvas } from './MindMapCanvas';

afterEach(cleanup);

const start = (): MindNode[] => addChild(addChild(newMap('m', 'Plan', 'now', 'r').nodes, 'r', 'a', 'Alpha'), 'a', 'a1', 'Alpha one');

/** The canvas held by a small parent, as the page holds it, so that edits come back as the next nodes. */
function Harness({ initial = start(), query = '', readOnly = false, spy }: { initial?: MindNode[]; query?: string; readOnly?: boolean; spy?: { changes: MindNode[][]; undo: () => void; redo: () => void; select: (id: string | null) => void } }) {
  const [nodes, setNodes] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  return <MindMapCanvas nodes={nodes} readOnly={readOnly} query={query} selected={selected}
    onChange={n => { spy?.changes.push(n); setNodes(n); }} onSelect={id => { spy?.select(id); setSelected(id); }} onUndo={() => spy?.undo()} onRedo={() => spy?.redo()} />;
}
const spy = () => ({ changes: [] as MindNode[][], undo: vi.fn(), redo: vi.fn(), select: vi.fn() });
const surface = () => q<HTMLElement>('[aria-label="Mind map"]')!;
const box = (text: string) => qa('g[data-node-id]').find(g => g.textContent?.includes(text))!;
const press = async (key: string, init: KeyboardEventInit = {}) => { await act(async () => { surface().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init })); }); };
const pick = async (text: string) => { await act(async () => { box(text).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 })); }); };
const labels = () => qa('g[data-node-id] text').map(t => t.textContent);

describe('the mind map drawing', () => {
  it('draws every idea as a box, and a curve to each from its parent', () => {
    mount(<Harness />);
    expect(labels()).toEqual(expect.arrayContaining(['Plan', 'Alpha', 'Alpha one']));
    expect(qa('path').length).toBe(2);
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

  it('zooms and fits with its buttons without failing', async () => {
    mount(<Harness />);
    for (const name of ['Zoom in', 'Zoom out', 'Fit to screen']) await act(async () => { q<HTMLButtonElement>(`button[aria-label="${name}"]`)!.click(); });
    expect(qa('g[data-node-id]').length).toBe(3);
  });
});
