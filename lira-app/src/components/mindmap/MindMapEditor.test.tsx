import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { makeIssue } from '../../test/factories';
import { byText, cleanup, click, mount, q, qa, settle, typeInto } from '../../test/render';
import { MIND_COLORS } from '../../theme/palette';
import { addChild, newMap, type MindMap } from '../../utils/mindmap';
import { MindMapEditor } from './MindMapEditor';
import { addShape, EMPTY_FREE, newShape } from '../../utils/mindFree';

const dialog = vi.hoisted(() => ({ confirmDialog: vi.fn(async () => true) }));
vi.mock('../common/dialogStore', () => dialog);
const files = vi.hoisted(() => ({ download: vi.fn(), svgToPng: vi.fn(async () => new Blob(['png'])) }));
vi.mock('../../utils/mindmapExport', async importOriginal => ({ ...(await importOriginal<typeof import('../../utils/mindmapExport')>()), ...files }));

const KEY = 'lira_mindmaps';
const saved = () => JSON.parse(localStorage.getItem(KEY) ?? '[]') as MindMap[];
const issues = [makeIssue({ key: 'LIRA-4', title: 'Offline mode', status: 'todo' })];
function Where() { return <p id="where">{useLocation().pathname}</p>; }
const open = (id = 'm1') => mount(
  <MemoryRouter initialEntries={[`/mindmaps/${id}`]}><Routes><Route path="/mindmaps" element={<p>list</p>} /><Route path="/mindmaps/:mapId" element={<MindMapEditor issues={issues} />} /></Routes><Where /></MemoryRouter>);
const seed = () => {
  const nodes = addChild(addChild(addChild(newMap('m1', 'Product ideas', 'now', 'r').nodes, 'r', 'a', 'Alpha'), 'r', 'b', 'Beta'), 'a', 'a1', 'Alpha one');
  localStorage.setItem(KEY, JSON.stringify([{ id: 'm1', name: 'Product ideas', nodes, createdAt: '2026-11-20T00:00:00Z', updatedAt: '2026-11-20T00:00:00Z' }]));
};
const seedFree = (free: object) => {
  const nodes = addChild(addChild(addChild(newMap('m1', 'Product ideas', 'now', 'r').nodes, 'r', 'a', 'Alpha'), 'r', 'b', 'Beta'), 'a', 'a1', 'Alpha one');
  localStorage.setItem(KEY, JSON.stringify([{ id: 'm1', name: 'Product ideas', nodes, ...free, createdAt: '2026-11-20T00:00:00Z', updatedAt: '2026-11-20T00:00:00Z' }]));
};
const seedWithShape = () => seedFree(addShape(EMPTY_FREE, { ...newShape('box', 'sx', 100, 100), text: 'Old box' }));
const node = (text: string) => qa('g[data-node-id]').find(g => g.textContent?.includes(text))!;
const pick = async (text: string) => { await act(async () => { node(text).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 })); }); };
const tool = (name: string) => q<HTMLButtonElement>(`[role="toolbar"] button[aria-label="${name}"]`)!;
const texts = () => saved()[0].nodes.map(n => n.text);

beforeEach(() => { localStorage.clear(); seed(); dialog.confirmDialog.mockReset(); dialog.confirmDialog.mockResolvedValue(true); files.download.mockReset(); });
afterEach(cleanup);

describe('the page of one storyboard', () => {
  it('shows the map under its name, with the ideas around the central one, and no panel until an idea is selected', () => {
    open();
    expect(q<HTMLInputElement>('input[aria-label="Storyboard name"]')!.value).toBe('Product ideas');
    expect(qa('g[data-node-id]')).toHaveLength(4);
    expect(q('aside[aria-label="Selected idea"]')).toBeNull();
    expect(tool('Add an idea').disabled).toBe(false); // with nothing selected it adds a branch to the central idea
    expect(tool('Delete').disabled).toBe(true);
  });

  it('says so when the map is not there, and goes back to the list', async () => {
    open('nope');
    expect(document.body.textContent).toContain('not here any more');
    await click(byText('button', 'All storyboards'));
    expect(q('#where')!.textContent).toBe('/mindmaps');
  });

  it('goes back to the list from the bar', async () => {
    open();
    await click(q('button[aria-label="All storyboards"]'));
    expect(q('#where')!.textContent).toBe('/mindmaps');
  });
});

describe('changing the map', () => {
  it('renames it in place and stars it, and keeps both', async () => {
    open();
    await typeInto(q<HTMLInputElement>('input[aria-label="Storyboard name"]'), 'Launch ideas');
    await click(q('button[aria-label="Star this storyboard"]'));
    expect(saved()[0]).toMatchObject({ name: 'Launch ideas', starred: true });
    await click(q('button[aria-label="Remove the star"]'));
    expect(saved()[0].starred).toBe(false);
  });

  it('adds an idea under the selected one with the tool, opens it for typing, and keeps what is typed', async () => {
    open();
    await pick('Alpha');
    expect(tool('Add an idea').disabled).toBe(false);
    await click(tool('Add an idea'));
    const input = q<HTMLInputElement>('input[aria-label="Idea text"]')!;
    expect(input.value).toBe('New idea');
    input.value = 'Fresh';
    await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(saved()[0].nodes.find(n => n.text === 'Fresh')).toMatchObject({ parentId: 'a' });
  });

  it('adds an idea next to the selected one, but not for the central idea', async () => {
    open();
    await pick('Plan').catch(() => undefined);
    await pick('Product ideas');
    expect(tool('Add an idea next to it').disabled).toBe(true);
    await pick('Alpha one');
    await click(tool('Add an idea next to it'));
    expect(saved()[0].nodes.filter(n => n.parentId === 'a')).toHaveLength(2);
  });

  it('edits the text with the tool', async () => {
    open();
    await pick('Beta');
    await click(tool('Edit the text'));
    expect(q('input[aria-label="Idea text"]')).not.toBeNull();
  });

  it('sets what the panel offers: the text, a colour, a note and a ticket', async () => {
    open();
    await pick('Alpha');
    const panel = () => q('aside[aria-label="Selected idea"]')!;
    expect(panel()).not.toBeNull();
    await typeInto(q<HTMLInputElement>('#idea-text'), 'Alpha renamed');
    await click(q(`button[aria-label="Colour ${MIND_COLORS[3]}"]`));
    await typeInto(q<HTMLTextAreaElement>('#idea-note'), 'Check the budget');
    await typeInto(q<HTMLInputElement>('#idea-ticket'), 'lira-4');
    expect(saved()[0].nodes.find(n => n.id === 'a')).toMatchObject({ text: 'Alpha renamed', color: MIND_COLORS[3], note: 'Check the budget', ticketKey: 'LIRA-4' });
    expect(panel().textContent).toContain('Offline mode (todo)');
    await click(q('button[aria-label="No colour"]'));
    expect(saved()[0].nodes.find(n => n.id === 'a')!.color).toBeUndefined();
  });

  it('does not let the text of an idea be emptied', async () => {
    open();
    await pick('Alpha');
    await typeInto(q<HTMLInputElement>('#idea-text'), '   ');
    expect(saved()[0].nodes.find(n => n.id === 'a')!.text).toBe('Alpha');
  });

  it('colours a branch from the tool, and goes back to the colour of its branch', async () => {
    open();
    await pick('Alpha');
    await click(tool('Colour'));
    await click(q(`[aria-label="Colour of the branch"] button[aria-label="Colour ${MIND_COLORS[5]}"]`));
    expect(saved()[0].nodes.find(n => n.id === 'a')!.color).toBe(MIND_COLORS[5]);
    await click(tool('Colour'));
    await click(q('[aria-label="Colour of the branch"] button[aria-label="Branch colour"]'));
    expect(saved()[0].nodes.find(n => n.id === 'a')!.color).toBeUndefined();
  });

  it('deletes an idea with its branch from the tool and from the panel, never the central idea', async () => {
    open();
    await pick('Product ideas');
    expect(tool('Delete').disabled).toBe(true);
    await pick('Alpha');
    await click(tool('Delete'));
    expect(texts()).toEqual(['Product ideas', 'Beta']);
    await pick('Beta');
    await click(byText('button', 'Delete idea and its branch'));
    expect(texts()).toEqual(['Product ideas']);
  });

  it('folds and unfolds every branch', async () => {
    open();
    await click(tool('Fold every branch'));
    expect(saved()[0].nodes.find(n => n.id === 'a')!.collapsed).toBe(true);
    expect(qa('g[data-node-id]')).toHaveLength(3);
    await click(tool('Unfold every branch'));
    expect(qa('g[data-node-id]')).toHaveLength(4);
  });

  it('undoes and redoes from the corner, keeping what is saved in step', async () => {
    open();
    expect(q<HTMLButtonElement>('button[aria-label="Undo"]')!.disabled).toBe(true);
    await pick('Alpha');
    await click(tool('Delete'));
    expect(texts()).toEqual(['Product ideas', 'Beta']);
    await click(q('button[aria-label="Undo"]'));
    expect(texts()).toContain('Alpha one');
    await click(q('button[aria-label="Redo"]'));
    expect(texts()).toEqual(['Product ideas', 'Beta']);
  });
});

describe('templates and imports', () => {
  it('replaces the ideas with a template after asking, and keeps them when the answer is no', async () => {
    open();
    await click(tool('Start from a template'));
    dialog.confirmDialog.mockResolvedValueOnce(false);
    await click(q('[role="menu"][aria-label="Templates"] button'));
    expect(texts()).toContain('Alpha');
    await click(tool('Start from a template'));
    await click(byText('button', /^Brainstorm/));
    await settle(20);
    expect(texts()).toContain('Top picks');
    expect(texts()).not.toContain('Alpha');
    expect(saved()[0].shapes!.filter(sh => sh.kind === 'note').length).toBe(12); // a wall of sticky notes came with it
  });

  it('imports an outline in place of the map, and keeps the map when the text has no ideas', async () => {
    open();
    await click(byText('button', 'Import outline'));
    await typeInto(q<HTMLTextAreaElement>('textarea[aria-label="Outline"]'), '   \n  ');
    await click(byText('button', 'Replace the storyboard'));
    expect(texts()).toContain('Alpha'); // nothing changed
    await typeInto(q<HTMLTextAreaElement>('textarea[aria-label="Outline"]'), '- Goals\n  - Grow\n  - Learn');
    await click(byText('button', 'Replace the storyboard'));
    expect(texts()).toEqual(['Goals', 'Grow', 'Learn']);
    await settle(500); // the dialog fades out
    expect(q('textarea[aria-label="Outline"]')).toBeNull();
  });

  it('cancels an import without changing anything', async () => {
    open();
    await click(byText('button', 'Import outline'));
    await click(byText('button', 'Cancel'));
    await settle(500); // the dialog fades out
    expect(q('textarea[aria-label="Outline"]')).toBeNull();
    expect(texts()).toContain('Alpha');
  });
});

describe('looking at the map in other ways', () => {
  it('shows the ideas as an indented outline, selects from it, and goes back to the map', async () => {
    open();
    await click(q('button[aria-pressed="false"][class*="px-3"]')); // Outline
    const items = qa('ul[aria-label="Outline"] li');
    expect(items.map(i => i.textContent)).toEqual(['Product ideas', 'Alpha', 'Alpha one', 'Beta']);
    await click(items[1].querySelector('button'));
    expect(q('aside[aria-label="Selected idea"]')).not.toBeNull();
    expect(q('[role="toolbar"]')).toBeNull(); // the tools belong to the map
    await click(byText('button', 'Board'));
    expect(q('[aria-label="Storyboard"]')).not.toBeNull();
  });

  it('rings the ideas a search finds', async () => {
    open();
    await typeInto(q<HTMLInputElement>('input[aria-label="Search the storyboard"]'), 'alpha');
    expect(qa('rect[stroke-dasharray]')).toHaveLength(2);
  });

  it('exports the map in each way, with a name from the map', async () => {
    open();
    for (const [label, ext] of [['Data (JSON)', 'product-ideas.json'], ['Outline (Markdown)', 'product-ideas.md'], ['Drawing (SVG)', 'product-ideas.svg'], ['Picture (PNG)', 'product-ideas.png']] as const) {
      await click(byText('button', 'Export'));
      await click(q(`[role="menu"][aria-label="Export"] button:is(:not([x]))`) && byText('button', label));
      await settle(10);
      expect(files.download).toHaveBeenLastCalledWith(ext, expect.any(String), expect.anything());
    }
  });
});

describe('adding ideas and drawing', () => {
  it('adds a branch to the central idea from the Add an idea tool when nothing is selected, and opens it for typing', async () => {
    open();
    await click(tool('Add an idea'));
    expect(saved()[0].nodes.find(n => n.text === 'New idea')).toMatchObject({ parentId: 'r' });
    expect(q('input[aria-label="Idea text"]')).not.toBeNull();
  });

  it('draws a box, a sticky note, an ellipse and text with the tools, each where the board is clicked, and keeps them', async () => {
    open();
    for (const [name, kind] of [['Box', 'box'], ['Sticky note', 'note'], ['Ellipse', 'ellipse'], ['Text', 'text']] as const) {
      await click(tool(name));
      expect(tool(name).getAttribute('aria-pressed')).toBe('true');
      await act(async () => { q('svg.touch-none')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 300 })); });
      await settle(10);
      await act(async () => { q('textarea[aria-label="Text of the shape"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
      expect(saved()[0].shapes!.at(-1)!.kind).toBe(kind);
    }
    expect(saved()[0].shapes).toHaveLength(4);
  });

  it('can be changed in the panel: the words, the style, the size and the colour of a shape, and deleted from there', async () => {
    seedWithShape();
    open();
    await act(async () => { qa('g[data-shape-id]')[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 })); });
    const panel = () => q('aside[aria-label="Selected shape"]')!;
    expect(panel().textContent).toContain('Box');
    await typeInto(q<HTMLTextAreaElement>('#shape-text'), 'Decision');
    await click(q('button[aria-label="Bold text"]'));
    await click(q('button[aria-label="Underline text"]'));
    await click(byText('button', 'Large'));
    await click(q(`button[aria-label="Shape colour ${MIND_COLORS[1]}"]`));
    expect(saved()[0].shapes![0]).toMatchObject({ text: 'Decision', bold: true, underline: true, size: 'large', color: MIND_COLORS[1] });
    await click(byText('button', 'Delete the shape'));
    expect(saved()[0].shapes).toEqual([]);
    expect(q('aside[aria-label="Selected shape"]')).toBeNull();
  });

  it('makes an idea bold, italic and underlined from the panel and from the toolbar, and takes it back', async () => {
    open();
    await pick('Alpha');
    await click(tool('Bold'));
    await click(q('aside[aria-label="Selected idea"] button[aria-label="Italic text"]'));
    await click(tool('Underline'));
    expect(saved()[0].nodes.find(n => n.id === 'a')).toMatchObject({ bold: true, italic: true, underline: true });
    expect(tool('Bold').getAttribute('aria-pressed')).toBe('true');
    await click(tool('Bold'));
    expect(saved()[0].nodes.find(n => n.id === 'a')!.bold).toBe(false);
  });

  it('has the text style tools off until something that can be styled is selected', async () => {
    open();
    expect(tool('Bold').disabled).toBe(true);
    await pick('Beta');
    expect(tool('Bold').disabled).toBe(false);
  });

  it('can be changed for a line: arrowhead, dashes and colour, and the line deleted', async () => {
    const free = { ...addShape(addShape(EMPTY_FREE, { ...newShape('box', 'sa', 100, 100), text: 'One' }), { ...newShape('box', 'sb', 400, 100), text: 'Two' }), links: [{ id: 'l1', from: 'sa', to: 'sb', arrow: false }] };
    seedFree(free);
    open();
    await act(async () => { q('g[data-link-id]')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    await click(byText('label', 'Arrowhead')!.querySelector('input'));
    await click(byText('label', 'Dashed')!.querySelector('input'));
    await click(q(`button[aria-label="Line colour ${MIND_COLORS[3]}"]`));
    expect(saved()[0].links![0]).toMatchObject({ arrow: true, dashed: true, color: MIND_COLORS[3] });
    await click(byText('button', 'Delete the line'));
    expect(saved()[0].links).toEqual([]);
    expect(saved()[0].shapes).toHaveLength(2);
  });

  it('undoes and redoes shapes too, along with the ideas', async () => {
    open();
    await click(tool('Box'));
    await act(async () => { q('svg.touch-none')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 300, clientY: 300 })); });
    await settle(10);
    await act(async () => { q('textarea[aria-label="Text of the shape"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(saved()[0].shapes).toHaveLength(1);
    await click(q('button[aria-label="Undo"]'));
    expect(saved()[0].shapes).toEqual([]);
    await click(q('button[aria-label="Redo"]'));
    expect(saved()[0].shapes).toHaveLength(1);
  });

  it('takes away what was pinned to an idea when the idea is deleted', async () => {
    const nodes = addChild(newMap('m1', 'Product ideas', 'now', 'r').nodes, 'r', 'a', 'Alpha');
    const free = { ...addShape(EMPTY_FREE, { ...newShape('box', 'sa', 100, 100), text: 'One' }), links: [{ id: 'l1', from: 'sa', to: 'a', arrow: true }], comments: [{ id: 'c1', targetId: 'a', x: 0, y: 0, text: 'About Alpha', author: 'A', at: 'now' }] };
    localStorage.setItem(KEY, JSON.stringify([{ id: 'm1', name: 'Product ideas', nodes, ...free, createdAt: 'now', updatedAt: 'now' }]));
    open();
    await pick('Alpha');
    await click(tool('Delete'));
    expect(saved()[0].links).toEqual([]);
    expect(saved()[0].comments).toEqual([]);
    expect(saved()[0].shapes).toHaveLength(1); // the shape itself stays
  });

  it('replaces the shapes too when a template with its own is chosen, and exports them with the data', async () => {
    seedWithShape();
    open();
    await click(tool('Start from a template'));
    await click(byText('button', /^Meeting notes/));
    await settle(20);
    expect(saved()[0].shapes!.some(sh => sh.text === 'Agenda')).toBe(true);
    expect(saved()[0].shapes!.some(sh => sh.text === 'Old box')).toBe(false);
    await click(byText('button', 'Export'));
    await click(byText('button', 'Data (JSON)'));
    const json = JSON.parse(files.download.mock.calls.at(-1)![2] as string);
    expect(json.shapes.length).toBe(saved()[0].shapes!.length);
  });

  it('reads a map saved before shapes existed, and ignores shapes that are not well formed', () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 'm1', name: 'Old', nodes: newMap('m1', 'Old', 'now', 'r').nodes, shapes: [{ id: 'x', kind: 'star' }, null], links: 'no', createdAt: 'now', updatedAt: 'now' }]));
    open();
    expect(qa('g[data-node-id]')).toHaveLength(1);
    expect(qa('g[data-shape-id]')).toHaveLength(0);
  });
});
