import { z } from 'zod';

const uuid = z.uuid();
const name = z.string().trim().min(1, 'Enter a name.').max(100, 'Use at most 100 characters.');

/** The roles a person can be given. Owner is held by whoever made the organisation and is not handed out here. */
export const ASSIGNABLE_ROLES = ['admin', 'member', 'viewer', 'guest'] as const;

export const updateMemberSchema = z.strictObject({ role: z.enum(ASSIGNABLE_ROLES).optional(), manageAccess: z.boolean().optional() })
  .refine(v => v.role !== undefined || v.manageAccess !== undefined, { message: 'Nothing to change.' });

export const teamSchema = z.strictObject({ name });
export const teamMembersSchema = z.strictObject({ userIds: z.array(uuid).max(500) });

export const grantSchema = z.strictObject({
  subjectType: z.enum(['user', 'team']),
  subjectId: uuid,
  kind: z.enum(['space', 'project', 'roadmap', 'dashboard']),
  objectId: z.string().regex(/^[A-Za-z0-9_.:-]{1,80}$/, 'Not an object id.'),
  level: z.enum(['view', 'edit', 'manage']),
});

/** The switches for what of a space, besides its tickets, a person invited to it sees. */
export const shareSchema = z.strictObject({ projects: z.boolean(), roadmaps: z.boolean(), dashboards: z.boolean(), sprints: z.boolean() });

export const inviteSchema = z.strictObject({
  email: z.string().trim().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Enter an email like you@example.com.').transform(s => s.toLowerCase()),
  role: z.enum(ASSIGNABLE_ROLES),
  teamId: uuid.optional(),
  /** One space, and how much of it the person gets. Both together or neither; an Admin already has every space, so an Admin invitation names none. */
  spaceId: z.number().int().positive().optional(),
  level: z.enum(['view', 'edit', 'manage']).optional(),
  /** What else of the space they see; each left out means yes. Only with a space. */
  shares: shareSchema.partial().optional(),
}).refine(v => (v.spaceId === undefined) === (v.level === undefined), { message: 'Choose a space and the access together.', path: ['level'] })
  .refine(v => v.shares === undefined || v.spaceId !== undefined, { message: 'Sharing choices need a space.', path: ['shares'] })
  .refine(v => v.spaceId === undefined || v.role !== 'admin', { message: 'An Admin has every space already.', path: ['role'] });

export const acceptSchema = z.strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'This invitation link is not valid.') });
