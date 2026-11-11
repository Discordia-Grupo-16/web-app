import type { Role, ServerMember } from '@discordia/api';
import { ADMINISTRATOR, MANAGE_ROLES, hasPermission } from '../permissions/permissions';
import type { RoleDeletionActor, RoleDeletionBlocker } from './types';

/**
 * Whether "Eliminar" is offered on the role (CA2 of SCRUM-64, Eliminar rol).
 *
 * It needs MANAGE_ROLES (an administrator has it: `my_permissions` arrives expanded) and, unless
 * whoever deletes is the owner, a role below their highest one. While their roles have not loaded
 * nothing is offered, like the other permission-gated actions. The default role and the only source
 * of ADMINISTRATOR are offered too: tapping them explains why they cannot be deleted.
 */
export const canOfferRoleDeletion = (role: Role, actor: RoleDeletionActor): boolean => {
    if (!hasPermission(actor.permissions, MANAGE_ROLES)) return false;
    if (actor.isOwner) return true;
    if (actor.roles.length === 0) return false;
    const highest = Math.max(...actor.roles.map(r => r.position));
    return role.position < highest;
};

/**
 * Why deleting the role is refused before asking for confirmation, or null when it is not.
 *
 * The default role first, like the backend. Then the only role that gives ADMINISTRATOR to whoever
 * deletes: the server would be left without anyone who can manage it. The owner's permissions do
 * not come from a role, so it never applies to them.
 */
export const roleDeletionBlocker = (role: Role, actor: RoleDeletionActor): RoleDeletionBlocker | null => {
    if (role.is_default) return 'default-role';
    if (actor.isOwner) return null;
    const holdsIt = actor.roles.some(r => r.id === role.id);
    const givesAdmin = hasPermission(role.permissions, ADMINISTRATOR);
    const otherAdmin = actor.roles.some(r => r.id !== role.id && hasPermission(r.permissions, ADMINISTRATOR));
    return holdsIt && givesAdmin && !otherAdmin ? 'sole-admin' : null;
};

/** The roles of userId in the member list; empty when it is not there or userId is undefined. */
export const rolesOfMember = (members: readonly ServerMember[], userId: string | undefined): Role[] =>
    members.find(m => m.user_id === userId)?.roles ?? [];
