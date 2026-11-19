import { describe, expect, it } from 'vitest';
import { searchSite, SITE_ENTRIES, type SiteEntry } from './pageSearch';

describe('searchSite', () => {
  it('finds a page by its title, ignoring case', () => {
    expect(searchSite('PRIVACY')[0].to).toBe('/privacy');
    expect(searchSite('roadmaps')[0].title).toBe('Roadmaps');
  });

  it('finds a page by the words in its text', () => {
    expect(searchSite('offline').map(e => e.title)).toContain('Your data');
  });

  it('puts title matches before text matches', () => {
    const entries: SiteEntry[] = [
      { title: 'Other', text: 'mentions sprints in passing', to: '/a' },
      { title: 'Sprints', text: 'about planning', to: '/b' },
    ];
    expect(searchSite('sprints', entries).map(e => e.to)).toEqual(['/b', '/a']);
  });

  it('needs every word to match', () => {
    expect(searchSite('weekly snapshots').map(e => e.title)).toEqual(['Dashboards']);
    expect(searchSite('weekly zebra')).toEqual([]);
  });

  it('returns nothing for an empty or blank query, or for text it does not know', () => {
    expect(searchSite('')).toEqual([]);
    expect(searchSite('   ')).toEqual([]);
    expect(searchSite('qwertyuiop')).toEqual([]);
  });

  it('limits the list, and cuts a very long query instead of working on all of it', () => {
    expect(searchSite('e', SITE_ENTRIES, 3)).toHaveLength(3);
    expect(searchSite(`${'x'.repeat(5000)}`)).toEqual([]);
  });

  it('never matches a regular-expression character as a pattern', () => {
    expect(searchSite('.*')).toEqual([]);
    expect(searchSite('(')).toEqual([]);
  });
});
