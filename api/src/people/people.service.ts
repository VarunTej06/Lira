import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ObjectKind } from '../access/access.service';
import { AuditService } from '../audit/audit.service';
import { DbService, type Queryable } from '../db/db.service';

export interface MemberOut { userId: string; name: string; email: string; role: string; manageAccess: boolean; teamIds: string[] }
export interface TeamOut { id: string; name: string; memberIds: string[] }
export interface GrantOut { id: string; subjectType: 'user' | 'team'; subjectId: string; kind: ObjectKind; objectId: string; level: 'view' | 'edit' | 'manage' }

const UNIQUE_VIOLATION = '23505';
const invalid = (field: string, message: string) => new BadRequestException({ code: 'invalid_input', message, fields: { [field]: message } });

/** People, teams and grants of one organisation. Every query carries the organisation, so one organisation never reaches another's. */
@Injectable()
export class PeopleService {
  constructor(@Inject(DbService) private readonly db: DbService, @Inject(AuditService) private readonly audit: AuditService) {}

  async members(orgId: string): Promise<MemberOut[]> {
    const rows = await this.db.query<{ user_id: string; name: string; email: string; role: string; manage_access: boolean; team_ids: string[] }>(
      `SELECT m.user_id, u.name, u.email, m.role, m.manage_access,
              COALESCE((SELECT array_agg(tm.team_id::text) FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE tm.user_id = m.user_id AND t.org_id = m.org_id), '{}') AS team_ids
         FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = $1 ORDER BY u.name`, [orgId]);
    return rows.rows.map(r => ({ userId: r.user_id, name: r.name, email: r.email, role: r.role, manageAccess: r.manage_access, teamIds: r.team_ids }));
  }

  async updateMember(orgId: string, actor: string, userId: string, changes: { role?: string; manageAccess?: boolean }, ip: string): Promise<void> {
    await this.db.transaction(async tx => {
      const current = await tx.query<{ role: string }>('SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2 FOR UPDATE', [orgId, userId]);
      if (!current.rows[0]) throw new NotFoundException('Not found.');
      if (current.rows[0].role === 'owner') throw invalid('role', 'The owner\'s role cannot be changed.');
      await tx.query('UPDATE memberships SET role = COALESCE($3, role), manage_access = COALESCE($4, manage_access) WHERE org_id = $1 AND user_id = $2', [orgId, userId, changes.role ?? null, changes.manageAccess ?? null]);
      await this.audit.record({ actor, orgId, action: 'member.update', outcome: 'ok', sourceIp: ip, detail: { userId, role: changes.role ?? null, manageAccess: changes.manageAccess ?? null } }, tx);
    });
  }

  /** Only the owner may remove an Admin; an Admin may remove anyone else except the owner. */
  async removeMember(orgId: string, actor: string, actorIsOwner: boolean, userId: string, ip: string): Promise<void> {
    await this.db.transaction(async tx => {
      const current = await tx.query<{ role: string }>('SELECT role FROM memberships WHERE org_id = $1 AND user_id = $2', [orgId, userId]);
      if (!current.rows[0]) throw new NotFoundException('Not found.');
      if (current.rows[0].role === 'owner') throw invalid('userId', 'The owner cannot be removed.');
      if (current.rows[0].role === 'admin' && !actorIsOwner) throw new ForbiddenException('You do not have access to this.');
      await tx.query('DELETE FROM team_members WHERE user_id = $2 AND team_id IN (SELECT id FROM teams WHERE org_id = $1)', [orgId, userId]);
      await tx.query("DELETE FROM grants WHERE org_id = $1 AND subject_type = 'user' AND subject_id = $2", [orgId, userId]);
      await tx.query('DELETE FROM memberships WHERE org_id = $1 AND user_id = $2', [orgId, userId]);
      await this.audit.record({ actor, orgId, action: 'member.remove', outcome: 'ok', sourceIp: ip, detail: { userId } }, tx);
    });
  }

  async teams(orgId: string): Promise<TeamOut[]> {
    const rows = await this.db.query<{ id: string; name: string; member_ids: string[] }>(
      `SELECT t.id, t.name, COALESCE((SELECT array_agg(user_id::text) FROM team_members WHERE team_id = t.id), '{}') AS member_ids FROM teams t WHERE t.org_id = $1 ORDER BY t.name`, [orgId]);
    return rows.rows.map(r => ({ id: r.id, name: r.name, memberIds: r.member_ids }));
  }

  async createTeam(orgId: string, actor: string, name: string, ip: string): Promise<TeamOut> {
    try {
      const made = await this.db.transaction(async tx => {
        const r = await tx.query<{ id: string }>('INSERT INTO teams (org_id, name, created_by) VALUES ($1, $2, $3) RETURNING id', [orgId, name, actor]);
        await this.audit.record({ actor, orgId, action: 'team.create', outcome: 'ok', sourceIp: ip, detail: { teamId: r.rows[0].id } }, tx);
        return r.rows[0].id;
      });
      return { id: made, name, memberIds: [] };
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) throw new ConflictException({ code: 'name_taken', message: 'A team with this name already exists.' });
      throw error;
    }
  }

  async renameTeam(orgId: string, actor: string, teamId: string, name: string, ip: string): Promise<void> {
    try {
      await this.db.transaction(async tx => {
        const r = await tx.query('UPDATE teams SET name = $3 WHERE org_id = $1 AND id = $2', [orgId, teamId, name]);
        if (r.rowCount === 0) throw new NotFoundException('Not found.');
        await this.audit.record({ actor, orgId, action: 'team.rename', outcome: 'ok', sourceIp: ip, detail: { teamId } }, tx);
      });
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) throw new ConflictException({ code: 'name_taken', message: 'A team with this name already exists.' });
      throw error;
    }
  }

  async deleteTeam(orgId: string, actor: string, teamId: string, ip: string): Promise<void> {
    await this.db.transaction(async tx => {
      const r = await tx.query('DELETE FROM teams WHERE org_id = $1 AND id = $2', [orgId, teamId]);
      if (r.rowCount === 0) throw new NotFoundException('Not found.');
      await tx.query("DELETE FROM grants WHERE org_id = $1 AND subject_type = 'team' AND subject_id = $2", [orgId, teamId]);
      await this.audit.record({ actor, orgId, action: 'team.delete', outcome: 'ok', sourceIp: ip, detail: { teamId } }, tx);
    });
  }

  /** Replaces the people of a team. Everyone named must belong to this organisation. */
  async setTeamMembers(orgId: string, actor: string, teamId: string, userIds: string[], ip: string): Promise<void> {
    await this.db.transaction(async tx => {
      if ((await tx.query('SELECT 1 FROM teams WHERE org_id = $1 AND id = $2', [orgId, teamId])).rowCount === 0) throw new NotFoundException('Not found.');
      const unique = [...new Set(userIds)];
      const found = await tx.query('SELECT 1 FROM memberships WHERE org_id = $1 AND user_id = ANY($2::uuid[])', [orgId, unique]);
      if (found.rowCount !== unique.length) throw invalid('userIds', 'Everyone in a team must belong to this organisation.');
      await tx.query('DELETE FROM team_members WHERE team_id = $1', [teamId]);
      if (unique.length) await tx.query('INSERT INTO team_members (team_id, user_id) SELECT $1, unnest($2::uuid[])', [teamId, unique]);
      await this.audit.record({ actor, orgId, action: 'team.members', outcome: 'ok', sourceIp: ip, detail: { teamId, count: unique.length } }, tx);
    });
  }

  async grants(orgId: string, kind?: ObjectKind, objectId?: string): Promise<GrantOut[]> {
    const rows = await this.db.query<{ id: string; subject_type: 'user' | 'team'; subject_id: string; object_kind: ObjectKind; object_id: string; level: GrantOut['level'] }>(
      'SELECT id, subject_type, subject_id, object_kind, object_id, level FROM grants WHERE org_id = $1 AND ($2::text IS NULL OR object_kind = $2) AND ($3::text IS NULL OR object_id = $3) ORDER BY created_at',
      [orgId, kind ?? null, objectId ?? null]);
    return rows.rows.map(r => ({ id: r.id, subjectType: r.subject_type, subjectId: r.subject_id, kind: r.object_kind, objectId: r.object_id, level: r.level }));
  }

  /** Gives, or changes, one level for one person or team on one object. The person, team and object must all be in this organisation. */
  async grant(orgId: string, actor: string, input: { subjectType: 'user' | 'team'; subjectId: string; kind: ObjectKind; objectId: string; level: GrantOut['level'] }, ip: string): Promise<GrantOut> {
    return this.db.transaction(async tx => {
      await this.requireSubject(tx, orgId, input.subjectType, input.subjectId);
      await this.requireObject(tx, orgId, input.kind, input.objectId);
      const r = await tx.query<{ id: string }>(
        `INSERT INTO grants (org_id, subject_type, subject_id, object_kind, object_id, level, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (org_id, subject_type, subject_id, object_kind, object_id) DO UPDATE SET level = EXCLUDED.level RETURNING id`,
        [orgId, input.subjectType, input.subjectId, input.kind, input.objectId, input.level, actor]);
      await this.audit.record({ actor, orgId, action: 'grant.set', outcome: 'ok', sourceIp: ip, detail: { ...input } }, tx);
      return { id: r.rows[0].id, ...input };
    });
  }

  async revoke(orgId: string, actor: string, grantId: string, ip: string): Promise<void> {
    await this.db.transaction(async tx => {
      const r = await tx.query<{ object_kind: string; object_id: string }>('DELETE FROM grants WHERE org_id = $1 AND id = $2 RETURNING object_kind, object_id', [orgId, grantId]);
      if (!r.rows[0]) throw new NotFoundException('Not found.');
      await this.audit.record({ actor, orgId, action: 'grant.revoke', outcome: 'ok', sourceIp: ip, detail: { grantId, kind: r.rows[0].object_kind, objectId: r.rows[0].object_id } }, tx);
    });
  }

  private async requireSubject(at: Queryable, orgId: string, type: 'user' | 'team', id: string): Promise<void> {
    const found = type === 'user'
      ? await at.query('SELECT 1 FROM memberships WHERE org_id = $1 AND user_id = $2', [orgId, id])
      : await at.query('SELECT 1 FROM teams WHERE org_id = $1 AND id = $2', [orgId, id]);
    if (found.rowCount === 0) throw invalid('subjectId', 'This person or team is not in the organisation.');
  }

  private async requireObject(at: Queryable, orgId: string, kind: ObjectKind, id: string): Promise<void> {
    const found = kind === 'space'
      ? await at.query('SELECT 1 FROM spaces WHERE org_id = $1 AND id::text = $2', [orgId, id])
      : await at.query('SELECT 1 FROM objects WHERE org_id = $1 AND kind = $2 AND id = $3', [orgId, kind, id]);
    if (found.rowCount === 0) throw invalid('objectId', 'This object does not exist in the organisation.');
  }
}
