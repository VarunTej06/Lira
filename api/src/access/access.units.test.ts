import { describe, expect, it } from 'vitest';
import { acceptSchema, grantSchema, inviteSchema, teamMembersSchema, teamSchema, updateMemberSchema } from '../people/schemas';
import { atLeast, capByRole, higher, isAdminRole } from './access.service';

describe('levels', () => {
  it('orders none, view, edit, manage', () => {
    expect(atLeast('manage', 'edit')).toBe(true);
    expect(atLeast('view', 'edit')).toBe(false);
    expect(atLeast('none', 'view')).toBe(false);
    expect(atLeast('edit', 'edit')).toBe(true);
    expect(higher('view', 'manage')).toBe('manage');
    expect(higher('none', 'none')).toBe('none');
  });

  it('caps a Viewer at view and a Guest at edit, whatever was granted, and leaves other roles alone', () => {
    expect(capByRole('viewer', 'manage')).toBe('view');
    expect(capByRole('viewer', 'edit')).toBe('view');
    expect(capByRole('viewer', 'none')).toBe('none');
    expect(capByRole('guest', 'manage')).toBe('edit');
    expect(capByRole('guest', 'view')).toBe('view');
    expect(capByRole('member', 'manage')).toBe('manage');
  });

  it('treats only Owner and Admin as admin roles', () => {
    expect(['owner', 'admin'].every(r => isAdminRole(r as never))).toBe(true);
    expect(['space_admin', 'member', 'viewer', 'guest'].some(r => isAdminRole(r as never))).toBe(false);
  });
});

describe('people schemas', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  it('refuses unknown fields everywhere, and the owner as a role to hand out', () => {
    expect(updateMemberSchema.safeParse({ role: 'owner' }).success).toBe(false);
    expect(updateMemberSchema.safeParse({ role: 'member', orgId: id }).success).toBe(false);
    expect(updateMemberSchema.safeParse({}).success).toBe(false);
    expect(updateMemberSchema.safeParse({ manageAccess: false }).success).toBe(true);
    expect(teamSchema.safeParse({ name: 'QA', org_id: id }).success).toBe(false);
    expect(teamSchema.safeParse({ name: '  ' }).success).toBe(false);
    expect(teamMembersSchema.safeParse({ userIds: ['x'] }).success).toBe(false);
    expect(teamMembersSchema.safeParse({ userIds: [id] }).success).toBe(true);
  });

  it('checks a grant: who, what, how much', () => {
    const good = { subjectType: 'team', subjectId: id, kind: 'space', objectId: '12', level: 'edit' };
    expect(grantSchema.safeParse(good).success).toBe(true);
    for (const bad of [{ level: 'owner' }, { kind: 'ticket' }, { subjectType: 'group' }, { subjectId: 'x' }, { objectId: '../x' }, { objectId: '' }, { extra: 1 }]) {
      expect(grantSchema.safeParse({ ...good, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('checks an invitation: an email, a role that can be handed out, and a link token of the right shape', () => {
    expect(inviteSchema.parse({ email: ' Asha@Example.com ', role: 'member' }).email).toBe('asha@example.com');
    expect(inviteSchema.safeParse({ email: 'asha', role: 'member' }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: 'a@b.co', role: 'owner' }).success).toBe(false);
    expect(acceptSchema.safeParse({ token: 'a'.repeat(43) }).success).toBe(true);
    expect(acceptSchema.safeParse({ token: 'short' }).success).toBe(false);
    expect(acceptSchema.safeParse({ token: 'a'.repeat(43), org: 'x' }).success).toBe(false);
  });
});
