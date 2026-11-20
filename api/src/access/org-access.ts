import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Me } from '../auth/auth.service';

export type Role = 'owner' | 'admin' | 'space_admin' | 'member' | 'viewer' | 'guest';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The caller's role in the organisation named in the address. A person who is not a member gets "not found", the same answer
 * as for an organisation that does not exist, so the address reveals nothing about other organisations.
 */
export function roleIn(me: Me, orgId: string): Role {
  const membership = UUID.test(orgId) ? me.organisations.find(o => o.orgId.toLowerCase() === orgId.toLowerCase()) : undefined;
  if (!membership) throw new NotFoundException('Not found.');
  return membership.role as Role;
}

const MANAGES_SPACES: readonly Role[] = ['owner', 'admin'];

/**
 * Until people and teams can be given access to single objects (ADR-0010), only an owner or an admin may reach spaces.
 * Everyone else is refused rather than shown an empty list, so nobody is led to think they have no spaces when they have no access.
 */
export function requireSpaceAccess(role: Role): void {
  if (!MANAGES_SPACES.includes(role)) throw new ForbiddenException('You do not have access to this.');
}
