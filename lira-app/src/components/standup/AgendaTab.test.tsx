import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, mount, qa } from '../../test/render';
import { makeIssue } from '../../test/factories';
import { buildAgenda } from '../../utils/standupUtils';
import { AgendaTab } from './AgendaTab';

afterEach(cleanup);

const many = (status: 'todo' | 'backlog' | 'inprogress', n: number, from: number) =>
  Array.from({ length: n }, (_, k) => makeIssue({ id: from + k, key: `T-${from + k}`, status, updatedAt: new Date(), createdAt: new Date() }));
const state = (view: 'status' | 'person', scoped: ReturnType<typeof many>, people: unknown[] = []) => ({
  agenda: buildAgenda(scoped, scoped), people, view, setView: () => undefined, copied: false, copyAgenda: () => undefined, notes: '', changeNotes: () => undefined, openIssue: () => undefined,
}) as unknown as Parameters<typeof AgendaTab>[0];

describe('the agenda of a call lists every open ticket', () => {
  it('shows all the To do, backlog and in progress tickets of the scope, not only the first few', () => {
    const scoped = [...many('todo', 20, 100), ...many('backlog', 25, 200), ...many('inprogress', 12, 300)];
    mount(<AgendaTab {...state('status', scoped)} />);
    const keys = qa('.font-mono').map(e => e.textContent);
    expect(scoped.every(i => keys.includes(i.key))).toBe(true);
  });

  it('shows every To do and backlog ticket of a person, not only three', () => {
    const todo = many('todo', 9, 100), backlog = many('backlog', 7, 200);
    const person = { key: 'VY', name: 'Varun', done: [], blocked: [], stale: [], doing: [], next: todo, backlog };
    mount(<AgendaTab {...state('person', [...todo, ...backlog], [person])} />);
    const keys = qa('button.truncate').map(e => e.textContent ?? '');
    expect([...todo, ...backlog].every(i => keys.some(k => k.includes(i.key)))).toBe(true);
  });
});
