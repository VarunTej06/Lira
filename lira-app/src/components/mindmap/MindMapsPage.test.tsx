import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { act } from 'react';
import { byText, cleanup, click, mount, q, qa, settle, typeInto } from '../../test/render';
import { MindMapsPage } from './MindMapsPage';

const dialog = vi.hoisted(() => ({ confirmDialog: vi.fn(async () => true) }));
vi.mock('../common/dialogStore', () => dialog);
const files = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock('../../utils/mindmapExport', async importOriginal => ({ ...(await importOriginal<typeof import('../../utils/mindmapExport')>()), download: files.download }));

const KEY = 'lira_mindmaps';
const saved = () => JSON.parse(localStorage.getItem(KEY) ?? '[]') as { id: string; name: string; nodes: { id: string; text: string; parentId: string | null }[] }[];
function Where() { return <p id="where">{useLocation().pathname}</p>; }
const page = (at = '/mindmaps') => mount(
  <MemoryRouter initialEntries={[at]}>
    <Routes><Route path="/mindmaps" element={<MindMapsPage issues={[]} />} /><Route path="/mindmaps/:mapId" element={<MindMapsPage issues={[]} />} /></Routes><Where />
  </MemoryRouter>);

beforeEach(() => { localStorage.clear(); dialog.confirmDialog.mockClear(); files.download.mockClear(); });
afterEach(cleanup);

async function makeOne() {
  page();
  await click(byText('button', 'New mind map'));
  await settle(30);
}

describe('the mind maps page', () => {
  it('offers to make the first mind map, and opens it with a central idea', async () => {
    page();
    expect(document.body.textContent).toContain('Make your first mind map');
    await click(byText('button', 'New mind map'));
    await settle(30);
    expect(saved()).toHaveLength(1);
    expect(q('#where')!.textContent).toBe(`/mindmaps/${saved()[0].id}`);
    expect(saved()[0].nodes).toEqual([{ id: expect.any(String), parentId: null, text: 'New mind map' }]);
    expect(q('[aria-label="Mind map"]')).not.toBeNull();
  });

  it('renames the map, and lists it by its new name', async () => {
    await makeOne();
    await typeInto(q<HTMLInputElement>('input[aria-label="Mind map name"]'), 'Launch plan');
    expect(saved()[0].name).toBe('Launch plan');
    expect(q('nav[aria-label="Mind maps"]')!.textContent).toContain('Launch plan');
  });

  it('makes a copy with new ids, keeping the shape, and deletes only after asking', async () => {
    await makeOne();
    await click(q('button[aria-label^="Copy"]'));
    await settle(30);
    const [first, second] = saved();
    expect(second.name).toBe('New mind map (copy)');
    expect(second.nodes.map(n => n.text)).toEqual(first.nodes.map(n => n.text));
    expect(second.nodes[0].id).not.toBe(first.nodes[0].id);
    dialog.confirmDialog.mockResolvedValueOnce(false);
    await click(q('button[aria-label^="Delete New mind map (copy)"]'));
    expect(saved()).toHaveLength(2);
    await click(q('button[aria-label^="Delete New mind map (copy)"]'));
    await settle(30);
    expect(saved()).toHaveLength(1);
    expect(q('#where')!.textContent).toBe('/mindmaps');
  });

  it('replaces the ideas with a pasted outline, and can be undone', async () => {
    await makeOne();
    await click(byText('button', 'Import outline'));
    const area = q<HTMLTextAreaElement>('textarea[aria-label="Outline"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(area, '- Plan\n  - A\n    - A1\n  - B');
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(byText('button', 'Replace the map'));
    expect(saved()[0].nodes.map(n => n.text)).toEqual(['Plan', 'A', 'A1', 'B']);
    await click(byText('button', 'Undo'));
    expect(saved()[0].nodes.map(n => n.text)).toEqual(['New mind map']);
    await click(byText('button', 'Redo'));
    expect(saved()[0].nodes).toHaveLength(4);
  });

  it('keeps the map when the pasted outline is empty', async () => {
    await makeOne();
    await click(byText('button', 'Import outline'));
    await click(byText('button', 'Replace the map'));
    expect(saved()[0].nodes).toHaveLength(1);
  });

  it('exports the map as JSON and as an outline, named after the map', async () => {
    await makeOne();
    await click(byText('button', 'json'));
    await click(byText('button', 'md'));
    expect(files.download.mock.calls.map(c => [c[0], c[1]])).toEqual([['new-mind-map.json', 'application/json'], ['new-mind-map.md', 'text/markdown']]);
    expect(files.download.mock.calls[1][2]).toContain('- New mind map');
  });

  it('folds and unfolds every branch from the toolbar, and lists many maps', async () => {
    await makeOne();
    await click(byText('button', 'New mind map'));
    await settle(30);
    expect(qa('nav[aria-label="Mind maps"] li')).toHaveLength(2);
    await click(byText('button', 'Fold all'));
    await click(byText('button', 'Unfold all'));
    expect(saved()).toHaveLength(2);
  });

  it('says so when the address names a map that is not there', () => {
    page('/mindmaps/missing');
    expect(document.body.textContent).toContain('Make your first mind map');
  });
});
