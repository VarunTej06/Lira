import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/db';
import { restoringIssuesExactly } from '../../db/db';
import { CELEBRATE_EVENT, celebrate } from '../../utils/celebrate';
import { AnimatedValue, CountUp, GrowBar } from './motion';
import { Confetti } from './Confetti';
import { makeIssue } from '../../test/factories';
import type { Issue } from '../../types/issue';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); });

describe('count-up', () => {
  it('counts up to the number and ends exactly on it', async () => {
    act(() => root.render(<CountUp value={47} suffix="%" />));
    await act(async () => { await wait(1300); });
    expect(host.textContent).toBe('47%');
  });

  it('shows plain text for values that are not numbers', () => {
    act(() => root.render(<AnimatedValue value="—" />));
    expect(host.textContent).toBe('—');
    act(() => root.render(<AnimatedValue value="3/9" />));
    expect(host.textContent).toBe('3/9');
  });

  it('counts "45%" style strings', async () => {
    act(() => root.render(<AnimatedValue value="45%" />));
    await act(async () => { await wait(1300); });
    expect(host.textContent).toBe('45%');
  });
});

describe('bars', () => {
  it('grow to their width', async () => {
    act(() => root.render(<GrowBar percent={60} className="bar" />));
    await act(async () => { await wait(1100); });
    expect((host.querySelector('.bar') as HTMLElement).style.width).toBe('60%');
  });
  it('never go past 0 to 100', async () => {
    act(() => root.render(<GrowBar percent={250} className="bar" />));
    await act(async () => { await wait(1100); });
    expect((host.querySelector('.bar') as HTMLElement).style.width).toBe('100%');
  });
});

describe('confetti', () => {
  it('bursts when something is celebrated, then clears', async () => {
    act(() => root.render(<Confetti />));
    expect(host.querySelector('[data-testid=confetti]')).toBeNull();
    await act(async () => { window.dispatchEvent(new CustomEvent(CELEBRATE_EVENT, { detail: { kind: 'sprint' } })); });
    expect(host.querySelectorAll('[data-testid=confetti] span').length).toBeGreaterThan(40);
    await act(async () => { await wait(2400); });
    expect(host.querySelector('[data-testid=confetti]')).toBeNull();
  });

  it('does nothing for people who prefer reduced motion', async () => {
    (window as unknown as { matchMedia: (q: string) => Partial<MediaQueryList> }).matchMedia = q => ({ matches: /reduce/.test(q), media: q });
    act(() => root.render(<Confetti />));
    await act(async () => { window.dispatchEvent(new CustomEvent(CELEBRATE_EVENT, { detail: { kind: 'done' } })); });
    expect(host.querySelector('[data-testid=confetti]')).toBeNull();
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  });
});

describe('when to celebrate', () => {
  let bursts = 0;
  const count = () => { bursts++; };
  beforeEach(async () => { bursts = 0; window.addEventListener(CELEBRATE_EVENT, count); await db.issues.clear(); await wait(520); });
  afterEach(() => window.removeEventListener(CELEBRATE_EVENT, count));

  const add = async (status = 'todo') => (await db.issues.add(makeIssue({ id: undefined, status }) as never)) as number;

  it('a ticket reaching Done', async () => {
    const id = await add();
    await db.issues.update(id, { status: 'inprogress' });
    expect(bursts).toBe(0);
    await db.issues.update(id, { status: 'done' });
    expect(bursts).toBe(1);
  });

  it('also when the change brings its own resolved date (Viva does this)', async () => {
    const id = await add();
    await db.issues.update(id, { status: 'done', resolvedAt: new Date(), updatedAt: new Date() });
    expect(bursts).toBe(1);
  });

  it('not for a ticket that is created as Done, or edited while Done, or moved back', async () => {
    const id = await add('done');
    await db.issues.update(id, { title: 'renamed' });
    await db.issues.update(id, { status: 'todo' });
    expect(bursts).toBe(0);
  });

  it('not when an undo puts a Done ticket back', async () => {
    const id = await add('todo');
    const before = (await db.issues.get(id)) as Issue;
    await db.issues.update(id, { status: 'done' });
    await wait(520);
    bursts = 0;
    await restoringIssuesExactly(() => db.issues.put(before));
    expect(bursts).toBe(0);
  });

  it('several tickets moved at once give one burst', async () => {
    const a = await add(), b = await add(), c = await add();
    await Promise.all([a, b, c].map(i => db.issues.update(i, { status: 'done' })));
    expect(bursts).toBe(1);
  });

  it('closing a sprint always celebrates', () => {
    celebrate('sprint');
    celebrate('sprint');
    expect(bursts).toBe(2);
  });
});
