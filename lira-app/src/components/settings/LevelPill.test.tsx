import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, mount, qa } from '../../test/render';
import { LevelPill } from './LevelPill';

afterEach(() => cleanup());

describe('LevelPill', () => {
  it('says the level in words for each of the three, in a different colour each', () => {
    mount(<><LevelPill level="view" /><LevelPill level="edit" /><LevelPill level="manage" /></>);
    const pills = qa('span');
    expect(pills.map(p => p.textContent)).toEqual(['Can view', 'Can edit', 'Can manage']);
    expect(new Set(pills.map(p => p.className)).size).toBe(3);
  });
});
