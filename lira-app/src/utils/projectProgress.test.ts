import { describe, expect, it } from 'vitest';
import type { Issue } from '../types/issue';
import { projectProgress } from './projectProgress';

const t = (status: string) => ({ status }) as Issue;

describe('projectProgress', () => {
  it('is zero for no tickets', () => expect(projectProgress([])).toEqual({ total: 0, done: 0, percent: 0 }));
  it('counts done tickets whatever the capitalisation and rounds the percent', () => {
    expect(projectProgress([t('done'), t('DONE'), t('todo')])).toEqual({ total: 3, done: 2, percent: 67 });
  });
  it('is 100 when everything is done', () => expect(projectProgress([t('done')]).percent).toBe(100));
});
