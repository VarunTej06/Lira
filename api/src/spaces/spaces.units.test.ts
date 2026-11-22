import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { requireSpaceAccess, roleIn } from '../access/org-access';
import type { Me } from '../auth/auth.service';
import { createSpaceSchema, deleteSpaceSchema, updateSpaceSchema } from './schemas';

const ORG = '11111111-1111-4111-8111-111111111111';
const me = (role: string): Me => ({ user: { id: 'u', email: 'a@b.co', name: 'A' }, organisations: [{ orgId: ORG, orgName: 'x', role }] });

describe('role in an organisation', () => {
  it('returns the role of a member, whatever the case of the id', () => {
    expect(roleIn(me('owner'), ORG)).toBe('owner');
    expect(roleIn(me('admin'), ORG.toUpperCase())).toBe('admin');
  });
  it('says "not found" for a stranger, an unknown id and something that is not an id, all the same way', () => {
    for (const id of ['22222222-2222-4222-8222-222222222222', 'nope', '', "1' OR '1'='1"]) expect(() => roleIn(me('owner'), id)).toThrow(NotFoundException);
  });
});

describe('who may reach spaces for now', () => {
  it('allows owner and admin only', () => {
    for (const role of ['owner', 'admin'] as const) expect(() => requireSpaceAccess(role)).not.toThrow();
    for (const role of ['space_admin', 'member', 'viewer', 'guest'] as const) expect(() => requireSpaceAccess(role)).toThrow(ForbiddenException);
  });
});

describe('space schemas', () => {
  const good = { key: 'lira', name: ' Lira ', icon: 'rocket', color: '#336699' };
  it('tidies the key and the name', () => {
    expect(createSpaceSchema.parse(good)).toMatchObject({ key: 'LIRA', name: 'Lira' });
  });
  it('refuses unknown fields and bad values', () => {
    for (const extra of [{ org_id: 'x' }, { id: 1 }, { version: 1 }, { key: 'A' }, { key: '1AB' }, { color: '#fff' }, { name: '' }, { icon: '' }]) {
      expect(createSpaceSchema.safeParse({ ...good, ...extra }).success, JSON.stringify(extra)).toBe(false);
    }
  });
  it('needs a version and at least one change to update, and never lets the key change', () => {
    expect(updateSpaceSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(updateSpaceSchema.safeParse({ name: 'x' }).success).toBe(false);
    expect(updateSpaceSchema.safeParse({ version: 1, key: 'NEW' }).success).toBe(false);
    expect(updateSpaceSchema.safeParse({ version: 2, name: 'x' }).success).toBe(true);
  });
  it('needs a version to delete', () => {
    expect(deleteSpaceSchema.safeParse({}).success).toBe(false);
    expect(deleteSpaceSchema.safeParse({ version: 3 }).success).toBe(true);
  });
});
