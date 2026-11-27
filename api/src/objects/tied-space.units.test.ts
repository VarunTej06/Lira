import { describe, expect, it } from 'vitest';
import { tiedSpace } from './tied-space';

describe('the space an object is tied to', () => {
  it('reads a project by space number, a roadmap by space key, and a dashboard that filters on one space', () => {
    expect(tiedSpace('project', { spaceId: 4 })).toEqual({ id: 4 });
    expect(tiedSpace('roadmap', { spaceKey: 'LIRA' })).toEqual({ key: 'LIRA' });
    expect(tiedSpace('dashboard', { filters: { spaceIds: [7] } })).toEqual({ id: 7 });
  });

  it('is none for a dashboard across several spaces or across all of them, and for anything without a space', () => {
    expect(tiedSpace('dashboard', { filters: { spaceIds: [1, 2] } })).toBeNull();
    expect(tiedSpace('dashboard', { filters: { spaceIds: [] } })).toBeNull();
    expect(tiedSpace('dashboard', {})).toBeNull();
    expect(tiedSpace('project', {})).toBeNull();
    expect(tiedSpace('roadmap', {})).toBeNull();
  });

  it('ignores values that are not a whole positive number or a non-empty key, so a crafted body ties to nothing', () => {
    for (const spaceId of [0, -3, 1.5, '4', null, [4], { id: 4 }]) expect(tiedSpace('project', { spaceId }), JSON.stringify(spaceId)).toBeNull();
    for (const spaceKey of ['', 7, null, ['LIRA']]) expect(tiedSpace('roadmap', { spaceKey }), JSON.stringify(spaceKey)).toBeNull();
    for (const filters of ['x', null, [], { spaceIds: 'all' }, { spaceIds: ['1'] }, { spaceIds: [0] }, { spaceIds: [1.5] }]) {
      expect(tiedSpace('dashboard', { filters }), JSON.stringify(filters)).toBeNull();
    }
  });
});
