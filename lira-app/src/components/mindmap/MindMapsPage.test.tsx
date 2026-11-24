import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { byText, choose, cleanup, click, mount, q, qa, settle, typeInto } from '../../test/render';
import { addChild, newMap, updateNode, type MindMap } from '../../utils/mindmap';
import { MindMapsPage } from './MindMapsPage';

const dialog = vi.hoisted(() => ({ confirmDialog: vi.fn(async () => true) }));
vi.mock('../common/dialogStore', () => dialog);

const KEY = 'lira_mindmaps';
const saved = () => JSON.parse(localStorage.getItem(KEY) ?? '[]') as MindMap[];
const seed = (...maps: MindMap[]) => localStorage.setItem(KEY, JSON.stringify(maps));
const make = (id: string, name: string, updatedAt = '2026-11-20T00:00:00Z', extra: Partial<MindMap> = {}): MindMap => ({ ...newMap(id, name, updatedAt, `${id}-r`, 'Asha'), ...extra });
function Where() { return <p id="where">{useLocation().pathname}</p>; }
const page = () => mount(<MemoryRouter initialEntries={['/mindmaps']}><Routes><Route path="/mindmaps" element={<MindMapsPage />} /><Route path="/mindmaps/:mapId" element={<p>editor</p>} /></Routes><Where /></MemoryRouter>);
const cards = () => qa('article').map(a => a.getAttribute('aria-label'));

beforeEach(() => { localStorage.clear(); dialog.confirmDialog.mockReset(); dialog.confirmDialog.mockResolvedValue(true); });
afterEach(cleanup);

describe('the list of mind maps', () => {
  it('says there is nothing yet, and offers the first one', () => {
    page();
    expect(document.body.textContent).toContain('Make your first mind map');
    expect(byText('button', 'New mind map')).toBeDefined();
  });

  it('shows the numbers and a card for each map with its ideas and linked tickets', async () => {
    const a = make('a', 'Product ideas');
    a.nodes = updateNode(addChild(addChild(a.nodes, 'a-r', 'a1', 'One'), 'a-r', 'a2', 'Two'), 'a1', { ticketKey: 'LIRA-4' });
    seed(a, make('b', 'Meeting', '2026-11-21T00:00:00Z', { starred: true }));
    page();
    await settle(1200); // the numbers count up
    const text = document.body.textContent!;
    expect(text).toContain('Mind maps');
    expect(text).toContain('1 starred');
    expect(q('article[aria-label="Product ideas"]')!.textContent).toContain('3 ideas');
    expect(q('article[aria-label="Product ideas"]')!.textContent).toContain('1 linked to tickets');
    expect(q('article[aria-label="Meeting"]')!.textContent).toContain('1 ideas');
  });

  it('shows the latest changed first, and sorts by name or by the number of ideas', async () => {
    const big = make('c', 'Big', '2026-11-01T00:00:00Z');
    big.nodes = addChild(addChild(big.nodes, 'c-r', 'c1', 'x'), 'c-r', 'c2', 'y');
    seed(make('a', 'Zebra', '2026-11-10T00:00:00Z'), make('b', 'Apple', '2026-11-20T00:00:00Z'), big);
    page();
    expect(cards()).toEqual(['Apple', 'Zebra', 'Big']);
    const sort = q<HTMLSelectElement>('select[aria-label="Sort"]')!;
    const pick = (v: string) => choose(sort, v);
    await pick('name');
    expect(cards()).toEqual(['Apple', 'Big', 'Zebra']);
    await pick('ideas');
    expect(cards()[0]).toBe('Big');
  });

  it('narrows to the starred ones and to a search, and says so when nothing matches', async () => {
    seed(make('a', 'Roadmap ideas', '2026-11-20T00:00:00Z', { starred: true }), make('b', 'Meeting notes'));
    page();
    await click(byText('button', 'Starred 1'));
    expect(cards()).toEqual(['Roadmap ideas']);
    await click(byText('button', 'All 2'));
    await typeInto(q<HTMLInputElement>('input[aria-label="Search mind maps"]'), 'meeting');
    expect(cards()).toEqual(['Meeting notes']);
    await typeInto(q<HTMLInputElement>('input[aria-label="Search mind maps"]'), 'zzz');
    expect(document.body.textContent).toContain('No mind map matches');
  });

  it('stars and unstars a map from its card, and keeps it', async () => {
    seed(make('a', 'Plan'));
    page();
    await click(q('button[aria-label="Star Plan"]'));
    expect(saved()[0].starred).toBe(true);
    await click(q('button[aria-label="Remove the star from Plan"]'));
    expect(saved()[0].starred).toBe(false);
  });

  it('opens a map from its picture or its name', async () => {
    seed(make('a', 'Plan'));
    page();
    await click(q('button[aria-label="Open Plan"]'));
    expect(q('#where')!.textContent).toBe('/mindmaps/a');
  });

  it('makes a copy that opens, and leaves the first one as it was', async () => {
    seed(make('a', 'Plan'));
    page();
    await click(q('button[aria-label="Copy Plan"]'));
    expect(saved().map(m => m.name)).toEqual(['Plan', 'Plan (copy)']);
    expect(q('#where')!.textContent).toBe(`/mindmaps/${saved()[1].id}`);
    expect(saved()[1].id).not.toBe('a');
  });

  it('deletes only after asking, and keeps the map when the answer is no', async () => {
    seed(make('a', 'Plan'));
    page();
    dialog.confirmDialog.mockResolvedValueOnce(false);
    await click(q('button[aria-label="Delete Plan"]'));
    expect(saved()).toHaveLength(1);
    await click(q('button[aria-label="Delete Plan"]'));
    expect(saved()).toHaveLength(0);
    expect(dialog.confirmDialog).toHaveBeenCalledWith(expect.objectContaining({ tone: 'danger' }));
  });
});

describe('making a mind map', () => {
  it('asks for a name and a template, makes the map with the template\'s ideas, and opens it', async () => {
    page();
    await click(byText('button', 'New mind map'));
    await typeInto(q<HTMLInputElement>('form[aria-label="New mind map"] input[type="text"], form[aria-label="New mind map"] #mm-name'), 'Launch plan');
    await click(q('input[name="template"]:not(:checked)')); // the first of the others
    await click(byText('button', 'Make the map'));
    await settle(30);
    expect(saved()).toHaveLength(1);
    expect(saved()[0]).toMatchObject({ name: 'Launch plan' });
    expect(saved()[0].nodes.length).toBeGreaterThan(5);
    expect(saved()[0].nodes.filter(n => n.parentId === null)).toHaveLength(1);
    expect(q('#where')!.textContent).toBe(`/mindmaps/${saved()[0].id}`);
  });

  it('makes a blank map whose central idea is the name, and names an unnamed one', async () => {
    page();
    await click(byText('button', 'New mind map'));
    await typeInto(q<HTMLInputElement>('#mm-name'), 'Just an idea');
    await click(byText('button', 'Make the map'));
    await settle(30);
    expect(saved()[0].nodes).toHaveLength(1);
    expect(saved()[0].nodes[0].text).toBe('Just an idea');
    cleanup();
    page();
    await click(byText('button', 'New mind map'));
    await click(byText('button', 'Make the map'));
    await settle(30);
    expect(saved()[1].name).toBe('New mind map');
  });

  it('cancels without making anything', async () => {
    page();
    await click(byText('button', 'New mind map'));
    await click(byText('button', 'Cancel'));
    expect(saved()).toHaveLength(0);
  });
});
