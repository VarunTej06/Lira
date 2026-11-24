import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { cleanup, mount, q, qa } from '../test/render';
import { readList, useStoredList, writeList } from './useStoredList';

interface Item { id: string; name: string }
const KEY = 'lira_test_list';
beforeEach(() => localStorage.clear());
afterEach(cleanup);

function Probe({ name }: { name: string }) {
  const [list, save] = useStoredList<Item>(KEY);
  return <div><ul>{list.map(i => <li key={i.id}>{i.name}</li>)}</ul><button type="button" onClick={() => save([...list, { id: `i${list.length}`, name }])}>add {name}</button></div>;
}

describe('a stored list', () => {
  it('reads as empty when nothing is saved, or the saved value is not a list, or is broken', () => {
    expect(readList(KEY)).toEqual([]);
    for (const bad of ['{"a":1}', 'not json', '5', 'null']) { localStorage.setItem(KEY, bad); expect(readList(KEY), bad).toEqual([]); }
  });

  it('keeps only items that have a text id', () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 'a', name: 'A' }, { name: 'no id' }, { id: 5 }, null, 'text', { id: 'b', name: 'B' }]));
    expect(readList<Item>(KEY).map(i => i.id)).toEqual(['a', 'b']);
  });

  it('writes the list, and every place showing it changes at once', async () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 'a', name: 'First' }]));
    mount(<><Probe name="x" /><Probe name="y" /></>);
    expect(qa('li').map(l => l.textContent)).toEqual(['First', 'First']);
    await act(async () => { q<HTMLButtonElement>('button')!.click(); });
    expect(qa('li').map(l => l.textContent)).toEqual(['First', 'x', 'First', 'x']);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual([{ id: 'a', name: 'First' }, { id: 'i1', name: 'x' }]);
  });

  it('writes from outside a component too', async () => {
    mount(<Probe name="x" />);
    await act(async () => { writeList<Item>(KEY, [{ id: 'z', name: 'From outside' }]); });
    expect(q('li')!.textContent).toBe('From outside');
  });
});
