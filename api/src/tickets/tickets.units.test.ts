import { describe, expect, it } from 'vitest';
import { createTicketSchema, deleteTicketSchema, updateTicketSchema } from './schemas';

const ticket = {
  title: ' Fix the board ', type: 'task', status: 'todo', priority: 'medium', rank: 1000, description: '<p>text</p>',
  reporter: 'Asha Rao', reporterInitials: 'AR', labels: [], subtasks: [], comments: [], activity: [], linkedIssues: [], watchers: [],
};

describe('ticket schemas', () => {
  it('accepts a whole ticket and trims the title', () => {
    expect(createTicketSchema.parse(ticket).title).toBe('Fix the board');
  });

  it('refuses fields a request must never set: id, organisation, key, version, space and attachments', () => {
    for (const extra of [{ id: 1 }, { org_id: 'x' }, { orgId: 'x' }, { key: 'A-1' }, { version: 3 }, { spaceId: 2 }, { attachments: [] }, { createdAt: '2026-11-20T10:00:00Z' }, { doc: {} }]) {
      expect(createTicketSchema.safeParse({ ...ticket, ...extra }).success, JSON.stringify(extra)).toBe(false);
    }
  });

  it('refuses bad values: empty title, unknown type or priority, a huge title, a bad date, a comment with extra fields', () => {
    const bad = [{ title: '  ' }, { type: 'story' }, { priority: 'urgent' }, { title: 'x'.repeat(501) }, { dueDate: 'tomorrow' }, { rank: Number.NaN },
      { labels: Array.from({ length: 51 }, () => 'a') }, { comments: [{ id: '1', author: 'a', authorInitials: 'A', content: 'x', createdAt: '2026-11-20T10:00:00Z', isAdmin: true }] }];
    for (const extra of bad) expect(createTicketSchema.safeParse({ ...ticket, ...extra }).success, JSON.stringify(extra).slice(0, 60)).toBe(false);
  });

  it('needs a version and a change to update, lets some fields be cleared with null, and never lets a required one be', () => {
    expect(updateTicketSchema.safeParse({ title: 'x' }).success).toBe(false);
    expect(updateTicketSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(updateTicketSchema.safeParse({ version: 1, title: 'x' }).success).toBe(true);
    expect(updateTicketSchema.safeParse({ version: 1, assignee: null, dueDate: null, parentId: null }).success).toBe(true);
    expect(updateTicketSchema.safeParse({ version: 1, title: null }).success).toBe(false);
    expect(updateTicketSchema.safeParse({ version: 1, status: null }).success).toBe(false);
  });

  it('refuses unknown fields in an update, and a change of space', () => {
    expect(updateTicketSchema.safeParse({ version: 1, spaceId: 2 }).success).toBe(false);
    expect(updateTicketSchema.safeParse({ version: 1, key: 'X-1' }).success).toBe(false);
    expect(updateTicketSchema.safeParse({ version: 1, attachments: [] }).success).toBe(false);
  });

  it('needs a version to delete', () => {
    expect(deleteTicketSchema.safeParse({}).success).toBe(false);
    expect(deleteTicketSchema.safeParse({ version: 2 }).success).toBe(true);
  });
});
