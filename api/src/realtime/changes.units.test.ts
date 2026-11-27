import { describe, expect, it } from 'vitest';
import type { Config } from '../config';
import { MetricsService } from '../observability/metrics.service';
import { ChangesService, type Change } from './changes.service';

/** The part that needs no database: who hears a note, and which notes are refused. */
const service = () => new ChangesService({} as never, {} as Config, new MetricsService());
const note = (o: object) => JSON.stringify(o);

describe('passing a change on', () => {
  it('tells the pages of that organisation and no others', () => {
    const s = service();
    const heard: Record<string, Change[]> = { a: [], b: [] };
    s.subscribe('org-a', 'u1', c => heard.a.push(c));
    s.subscribe('org-b', 'u2', c => heard.b.push(c));
    s.dispatch(note({ o: 'org-a', k: 'ticket', s: 4 }));
    expect(heard.a).toEqual([{ kind: 'ticket', spaceId: 4 }]);
    expect(heard.b).toEqual([]);
  });

  it('keeps no one listening once they stop, and counts the open streams of each person', () => {
    const s = service();
    const heard: Change[] = [];
    const stop = s.subscribe('org-a', 'u1', c => heard.push(c));
    const other = s.subscribe('org-a', 'u1', () => undefined);
    expect(s.openFor('u1')).toBe(2);
    expect(s.openFor('u2')).toBe(0);
    stop();
    expect(s.openFor('u1')).toBe(1);
    s.dispatch(note({ o: 'org-a', k: 'space', s: null }));
    expect(heard).toEqual([]);
    other();
    expect(s.openFor('u1')).toBe(0);
  });

  it('drops a note that is not the shape it expects, so nothing odd reaches a page', () => {
    const s = service();
    const heard: Change[] = [];
    s.subscribe('org-a', 'u1', c => heard.push(c));
    for (const bad of [undefined, '', 'not json', 'null', '[]', note({ o: 'org-a' }), note({ o: 'org-a', k: 'kv', s: 1 }), note({ o: 'org-a', k: 'ticket', s: '4' }),
      note({ o: 'org-a', k: 'ticket', s: 1.5 }), note({ o: 7, k: 'ticket', s: 1 }), note({ k: 'ticket', s: 1 })]) {
      s.dispatch(bad);
    }
    expect(heard).toEqual([]);
    s.dispatch(note({ o: 'org-a', k: 'space', s: null }));
    expect(heard).toEqual([{ kind: 'space', spaceId: null }]);
  });
});
