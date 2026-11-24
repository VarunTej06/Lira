import { describe, expect, it } from 'vitest';
import { pathFor, routeForTab, spacePath } from '../routes';
import { issueHref, issueLink, linkProps, pageLink, projectLink, roadmapLink, spaceLink, sprintLink } from './links';

describe('addresses for "open in a new tab"', () => {
  it('leaves nothing for what has no address', () => {
    expect(linkProps(undefined)).toEqual({});
    expect(linkProps(null)).toEqual({});
    expect(linkProps('')).toEqual({});
    expect(issueLink(undefined)).toEqual({});
    expect(issueLink({ key: '' })).toEqual({});
    expect(sprintLink(undefined)).toEqual({});
    expect(projectLink(undefined)).toEqual({});
    expect(roadmapLink(undefined)).toEqual({});
    expect(spaceLink(undefined)).toEqual({});
    expect(pageLink(undefined)).toEqual({});
  });
  it('opens a ticket over the board of its own space, whatever number it has', () => {
    expect(issueHref('LIRA-12')).toBe(`${spacePath('LIRA', 'Board')}?issue=LIRA-12`);
    expect(issueHref('MY-SPACE-7')).toBe(`${spacePath('MY-SPACE', 'Board')}?issue=MY-SPACE-7`); // the last dash splits the number off
    expect(issueHref('ODD')).toBe(`${spacePath('ODD', 'Board')}?issue=ODD`);
    expect(issueLink({ key: 'LIRA-3' })).toEqual({ 'data-href': issueHref('LIRA-3') });
  });
  it('writes a key that has odd letters so that it cannot break the address', () => {
    expect(issueHref('A B-1')).toContain('issue=A%20B-1');
  });
  it('gives sprints, projects, roadmaps and spaces their own addresses, with what is typed made safe', () => {
    expect(sprintLink('2026-11')).toEqual({ 'data-href': '/sprints/2026-11' });
    expect(projectLink('p 1')).toEqual({ 'data-href': '/projects/p%201' });
    expect(roadmapLink('rm/1')).toEqual({ 'data-href': '/roadmaps/rm%2F1' });
    expect(spaceLink('LIRA')).toEqual({ 'data-href': spacePath('LIRA', 'Board') });
    expect(spaceLink('LIRA', 'Calendar')).toEqual({ 'data-href': spacePath('LIRA', 'Calendar') });
  });
  it('gives each page of the sidebar the address its name stands for', () => {
    expect(pageLink('Projects')).toEqual({ 'data-href': pathFor(routeForTab('Projects')) });
    expect(pageLink('SprintsHub')).toEqual({ 'data-href': pathFor(routeForTab('SprintsHub')) });
  });
});
