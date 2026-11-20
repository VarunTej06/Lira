import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Me } from '../auth/auth.service';
import { DbService } from '../db/db.service';
import { roleIn, type Role } from './org-access';

export type Level = 'none' | 'view' | 'edit' | 'manage';
export type ObjectKind = 'space' | 'project' | 'roadmap' | 'dashboard';

const RANK: Record<Level, number> = { none: 0, view: 1, edit: 2, manage: 3 };
const BY_RANK: Level[] = ['none', 'view', 'edit', 'manage'];

export const atLeast = (have: Level, need: Level): boolean => RANK[have] >= RANK[need];
export const higher = (a: Level, b: Level): Level => (RANK[a] >= RANK[b] ? a : b);

/** What a role allows at most, whatever was granted: a Viewer can only ever view, a Guest can never manage. */
export function capByRole(role: Role, level: Level): Level {
  if (role === 'viewer') return BY_RANK[Math.min(RANK[level], RANK.view)];
  if (role === 'guest') return BY_RANK[Math.min(RANK[level], RANK.edit)];
  return level;
}

export const isAdminRole = (role: Role): boolean => role === 'owner' || role === 'admin';

/**
 * The one place that decides what a person may do with an object (ADR-0010). Owner and Admin have everything in their
 * organisation; anyone else has the highest grant they hold, directly or through a team, capped by their role.
 * A person with no access at all gets "not found", so they cannot tell that an object exists.
 */
@Injectable()
export class AccessService {
  constructor(@Inject(DbService) private readonly db: DbService) {}

  /** The role in the organisation. A stranger gets "not found". */
  role(me: Me, orgId: string): Role { return roleIn(me, orgId); }

  async levelOn(me: Me, orgId: string, kind: ObjectKind, id: string | number): Promise<Level> {
    const role = roleIn(me, orgId);
    if (isAdminRole(role)) return 'manage';
    const rows = await this.db.query<{ level: Level }>(
      `SELECT level FROM grants WHERE org_id = $1 AND object_kind = $2 AND object_id = $3
         AND ((subject_type = 'user' AND subject_id = $4) OR (subject_type = 'team' AND subject_id IN (SELECT team_id FROM team_members WHERE user_id = $4)))`,
      [orgId, kind, String(id), me.user.id]);
    return capByRole(role, rows.rows.reduce<Level>((best, r) => higher(best, r.level), 'none'));
  }

  /** Throws "not found" for no access and "forbidden" for too little, and returns the level the person has. */
  async require(me: Me, orgId: string, kind: ObjectKind, id: string | number, need: Level): Promise<Level> {
    const have = await this.levelOn(me, orgId, kind, id);
    if (have === 'none') throw new NotFoundException('Not found.');
    if (!atLeast(have, need)) throw new ForbiddenException('You do not have access to this.');
    return have;
  }

  /** Every object of a kind the person may at least view: all of them for an Owner or Admin, otherwise the granted ones. */
  async visible(me: Me, orgId: string, kind: ObjectKind): Promise<'all' | Map<string, Level>> {
    const role = roleIn(me, orgId);
    if (isAdminRole(role)) return 'all';
    const rows = await this.db.query<{ object_id: string; level: Level }>(
      `SELECT object_id, level FROM grants WHERE org_id = $1 AND object_kind = $2
         AND ((subject_type = 'user' AND subject_id = $3) OR (subject_type = 'team' AND subject_id IN (SELECT team_id FROM team_members WHERE user_id = $3)))`,
      [orgId, kind, me.user.id]);
    const out = new Map<string, Level>();
    for (const r of rows.rows) out.set(r.object_id, higher(out.get(r.object_id) ?? 'none', capByRole(role, r.level)));
    return out;
  }

  /** Only an Owner or Admin may create the top-level things of an organisation (spaces, projects, roadmaps). */
  requireAdmin(me: Me, orgId: string): void {
    if (!isAdminRole(roleIn(me, orgId))) throw new ForbiddenException('You do not have access to this.');
  }

  /** Whether the person may add people, make teams and change access: the Owner, and an Admin the owner has not switched off. */
  async canManageAccess(me: Me, orgId: string): Promise<boolean> {
    const role = roleIn(me, orgId);
    if (role === 'owner') return true;
    if (role !== 'admin') return false;
    const r = await this.db.query<{ manage_access: boolean }>('SELECT manage_access FROM memberships WHERE org_id = $1 AND user_id = $2', [orgId, me.user.id]);
    return r.rows[0]?.manage_access === true;
  }

  async requireManageAccess(me: Me, orgId: string): Promise<void> {
    if (!(await this.canManageAccess(me, orgId))) throw new ForbiddenException('You do not have access to this.');
  }
}
