import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { makeIssue } from '../../test/factories';
import { byText, cleanup, click, mount, q, qa, settle, typeInto } from '../../test/render';
import { MIND_COLORS } from '../../theme/palette';
import { addChild, newMap, type MindMap } from '../../utils/mindmap';
import { MindMapEditor } from './MindMapEditor';

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
const node = (text: string) => qa('g[data-node-id]').find(g => g.textContent?.includes(text))!;
const pick = async (text: string) => { await act(async () => { node(text).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 })); }); };
const tool = (name: string) => q<HTMLButtonElement>(`[role="toolbar"] button[aria-label="${name}"]`)!;
const texts = () => saved()[0].nodes.map(n => n.text);

beforeEach(() => { localStorage.clear(); seed(); dialog.confirmDialog.mockReset(); dialog.confirmDialog.mockResolvedValue(true); files.download.mockReset(); });
afterEach(cleanup);

describe('the page of one mind map', () => {
  it('shows the map under its name, with the ideas around the central one, and no panel until an idea is selected', () => {
    open();
    expect(q<HTMLInputElement>('input[aria-label="Mind map name"]')!.value).toBe('Product ideas');
    expect(qa('g[data-node-id]')).toHaveLength(4);
    expect(q('aside[aria-label="Selected idea"]')).toBeNull();
    expect(tool('Add an idea').disabled).toBe(true); // nothing is selected yet
  });

  it('says so when the map is not there, and goes back to the list', async () => {
    open('nope');
    expect(document.body.textContent).toContain('not here any more');
    await click(byText('button', 'All mind maps'));
    expect(q('#where')!.textContent).toBe('/mindmaps');
  });

  it('goes back to the list from the bar', async () => {
    open();
    await click(q('button[aria-label="All mind maps"]'));
    expect(q('#where')!.textContent).toBe('/mindmaps');
  });
});

describe('changing the map', () => {
  it('renames it in place and stars it, and keeps both', async () => {
    open();
    await typeInto(q<HTMLInputElement>('input[aria-label="Mind map name"]'), 'Launch ideas');
    await click(q('button[aria-label="Star this mind map"]'));
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
    expect(tool('Delete the idea and its branch').disabled).toBe(true);
    await pick('Alpha');
    await click(tool('Delete the idea and its branch'));
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
    await click(tool('Delete the idea and its branch'));
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
    expect(texts()).toContain('Topic');
    expect(texts()).not.toContain('Alpha');
  });

  it('imports an outline in place of the map, and keeps the map when the text has no ideas', async () => {
    open();
    await click(byText('button', 'Import outline'));
    await typeInto(q<HTMLTextAreaElement>('textarea[aria-label="Outline"]'), '   \n  ');
    await click(byText('button', 'Replace the map'));
    expect(texts()).toContain('Alpha'); // nothing changed
    await typeInto(q<HTMLTextAreaElement>('textarea[aria-label="Outline"]'), '- Goals\n  - Grow\n  - Learn');
    await click(byText('button', 'Replace the map'));
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
    await click(byText('button', 'Map'));
    expect(q('[aria-label="Mind map"]')).not.toBeNull();
  });

  it('rings the ideas a search finds', async () => {
    open();
    await typeInto(q<HTMLInputElement>('input[aria-label="Search the map"]'), 'alpha');
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
