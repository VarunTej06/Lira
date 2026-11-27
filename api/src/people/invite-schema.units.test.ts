import { describe, expect, it } from 'vitest';
import { inviteSchema } from './schemas';

const base = { email: ' Guest@Example.com ', role: 'guest' };

describe('the invitation request', () => {
  it('accepts an organisation invitation, and one that names a space with its access', () => {
    expect(inviteSchema.parse(base)).toMatchObject({ email: 'guest@example.com', role: 'guest' });
    expect(inviteSchema.parse({ ...base, spaceId: 4, level: 'edit' })).toMatchObject({ spaceId: 4, level: 'edit' });
  });

  it('wants the space and the access together, never one without the other', () => {
    expect(inviteSchema.safeParse({ ...base, spaceId: 4 }).success).toBe(false);
    expect(inviteSchema.safeParse({ ...base, level: 'edit' }).success).toBe(false);
  });

  it('does not let an Admin be tied to one space, and takes only whole positive space numbers and the three levels', () => {
    expect(inviteSchema.safeParse({ ...base, role: 'admin', spaceId: 4, level: 'manage' }).success).toBe(false);
    for (const spaceId of [0, -1, 1.5, '4', null]) expect(inviteSchema.safeParse({ ...base, spaceId, level: 'view' }).success).toBe(false);
    for (const level of ['owner', 'none', '', 3]) expect(inviteSchema.safeParse({ ...base, spaceId: 4, level }).success).toBe(false);
  });

  it('refuses fields it does not know, such as another organisation', () => {
    expect(inviteSchema.safeParse({ ...base, orgId: 'x' }).success).toBe(false);
  });
});
