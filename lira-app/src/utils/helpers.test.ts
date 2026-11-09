import { describe, expect, it } from 'vitest';
import { issueHref, issueLink, linkProps, pageLink, projectLink, roadmapLink, sprintLink, spaceLink } from './links';
import { matchesStatusFilter } from './spaceFilters';
import { MAX_EMBED_BYTES, SOURCE_LABEL, downloadAttachment, formatBytes, readAttachment } from './attachments';
import { formatAbsoluteDate, formatDayDateTime, formatRelativeDate } from './dateUtils';
import { PRIORITY_CONFIG } from './priorityUtils';
import { STATUS_LIST, STATUS_META, BLOCKED_META, isBlocked, statusLabel } from './status';
import { hasCommentContent, isOwnComment } from '../components/issue/IssueActivityFeed';
import { makeIssue } from '../test/factories';

describe('links (what "Open in new tab" opens)', () => {
  it('a ticket opens as the popup over its own space board', () => {
    expect(issueHref('LIRA-12')).toBe('/space/LIRA/board?issue=LIRA-12');
    expect(issueHref('CERT-4')).toBe('/space/CERT/board?issue=CERT-4');
    expect(issueHref('MY-SPACE-7')).toBe('/space/MY-SPACE/board?issue=MY-SPACE-7'); // a space key may hold a dash
  });
  it('pages, sprints, projects, roadmaps and spaces have their own addresses', () => {
    expect(sprintLink('2026-11')).toEqual({ 'data-href': '/sprints/2026-11' });
    expect(projectLink('proj 1')).toEqual({ 'data-href': '/projects/proj%201' });
    expect(roadmapLink('rm-lira')).toEqual({ 'data-href': '/roadmaps/rm-lira' });
    expect(spaceLink('LIRA', 'Calendar')).toEqual({ 'data-href': '/space/LIRA/calendar' });
    expect(pageLink('SprintsHub')).toEqual({ 'data-href': '/sprints' });
    expect(pageLink('Dashboards')).toEqual({ 'data-href': '/dashboards' });
  });
  it('gives nothing when there is nothing to link to', () => {
    expect(linkProps(undefined)).toEqual({});
    expect(issueLink(undefined)).toEqual({});
    expect(sprintLink(undefined)).toEqual({});
    expect(pageLink(undefined)).toEqual({});
  });
});

describe('Status filter (a ticket matches by its status, or by the Blocked switch)', () => {
  it('no choice means everything passes', () => {
    expect(matchesStatusFilter({ status: 'done' })).toBe(true);
    expect(matchesStatusFilter({ status: 'done' }, [])).toBe(true);
  });
  it('matches any of the chosen statuses', () => {
    expect(matchesStatusFilter({ status: 'todo' }, ['todo', 'inprogress'])).toBe(true);
    expect(matchesStatusFilter({ status: 'done' }, ['todo', 'inprogress'])).toBe(false);
  });
  it('"blocked" matches tickets switched to Blocked, whatever their status', () => {
    expect(matchesStatusFilter({ status: 'inprogress', blocked: true }, ['blocked'])).toBe(true);
    expect(matchesStatusFilter({ status: 'inprogress', blocked: false }, ['blocked'])).toBe(false);
    expect(matchesStatusFilter({ status: 'done', blocked: true }, ['todo', 'blocked'])).toBe(true);
  });
});

describe('Attachments', () => {
  it('formats sizes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
  it('keeps a small file inside the ticket and only the name of a big one', async () => {
    const small = await readAttachment(new File(['hi'], 'a.txt', { type: 'text/plain' }));
    expect(small.embedded).toBe(true);
    expect(small.attachment).toMatchObject({ name: 'a.txt', size: 2, type: 'text/plain' });
    expect(small.attachment.dataUrl).toMatch(/^data:text\/plain/);
    const big = new File([new Uint8Array(MAX_EMBED_BYTES + 1)], 'big.bin');
    const r = await readAttachment(big);
    expect(r.embedded).toBe(false);
    expect(r.attachment.dataUrl).toBeUndefined();
  });
  it('a file pasted without a name still gets one, and each gets its own id', async () => {
    const a = await readAttachment(new File(['x'], ''));
    const b = await readAttachment(new File(['x'], ''));
    expect(a.attachment.name).toBe('pasted-file');
    expect(a.attachment.id).not.toBe(b.attachment.id);
  });
  it('only a stored file can be downloaded', () => {
    expect(downloadAttachment({ id: '1', name: 'x', size: 1, type: '', createdAt: new Date() })).toBe(false);
  });
  it('names where a link comes from', () => {
    expect(SOURCE_LABEL.drive).toBe('Google Drive');
    expect(SOURCE_LABEL.onedrive).toBe('OneDrive');
  });
});

describe('Dates shown to people', () => {
  it('writes the day, date and time of a comment', () => {
    expect(formatDayDateTime(new Date(2026, 10, 9, 0, 5))).toBe('Mon, 9 Nov 2026 at 12:05 AM');
    expect(formatDayDateTime(new Date(2026, 10, 9, 13, 30))).toBe('Mon, 9 Nov 2026 at 1:30 PM');
    expect(formatDayDateTime('not a date')).toBe('');
    expect(formatDayDateTime(null)).toBe('');
  });
  it('writes plain and relative dates, and survives bad input', () => {
    expect(formatAbsoluteDate(new Date(2026, 10, 9))).toBe('9 Nov 2026');
    expect(formatRelativeDate(new Date())).toBe('Today');
    expect(formatRelativeDate(undefined)).toBe('');
    expect(formatAbsoluteDate('garbage')).toBe('');
  });
});

describe('Priorities and statuses', () => {
  it('every priority has a label and colours', () => {
    for (const p of ['highest', 'high', 'medium', 'low', 'lowest'] as const) {
      expect(PRIORITY_CONFIG[p].label).toBeTruthy();
      expect(PRIORITY_CONFIG[p].color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
  it('every status has a label and both colours; Blocked has its own', () => {
    STATUS_LIST.forEach(s => { expect(s.label).toBeTruthy(); expect(s.color).toMatch(/^#/); expect(s.bg).toMatch(/^#/); });
    expect(STATUS_META.inprogress.label).toBe('In Progress');
    expect(BLOCKED_META.label).toBe('Blocked');
    expect(statusLabel('done')).toBe('Done');
    expect(isBlocked(makeIssue({ blocked: true }))).toBe(true);
  });
});

describe('Comments', () => {
  it('a comment needs text or a file to be posted', () => {
    expect(hasCommentContent('', [])).toBe(false);
    expect(hasCommentContent('<p></p>', [])).toBe(false);
    expect(hasCommentContent('<p> </p>', [])).toBe(false);
    expect(hasCommentContent('<p>hi</p>', [])).toBe(true);
    expect(hasCommentContent('', [{ id: '1', name: 'a.png', size: 1, type: 'image/png', createdAt: new Date() }])).toBe(true);
  });
  it('only the person who wrote a comment may edit it (by name or by initials)', () => {
    localStorage.setItem('lira_user_name', 'Varuntej Yadla');
    localStorage.setItem('lira_user_initials', 'VY');
    const base = { id: '1', content: 'x', createdAt: new Date() };
    expect(isOwnComment({ ...base, author: 'VY', authorInitials: 'VY' })).toBe(true);
    expect(isOwnComment({ ...base, author: 'Varuntej Yadla', authorInitials: '' })).toBe(true);
    expect(isOwnComment({ ...base, author: 'Alex Morgan', authorInitials: 'AM' })).toBe(false);
    expect(isOwnComment({ ...base, author: '', authorInitials: '' })).toBe(false);
    localStorage.clear();
  });
});
