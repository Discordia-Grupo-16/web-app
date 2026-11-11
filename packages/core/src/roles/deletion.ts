import type { Role, ServerMember } from '@discordia/api';
import type { RoleDeletionActor, RoleDeletionBlocker } from './types';

/** Whether "Eliminar" is offered on the role (CA2 of SCRUM-64, Eliminar rol). */
export const canOfferRoleDeletion = (_role: Role, _actor: RoleDeletionActor): boolean => {
    throw new Error('not implemented');
};

/** Why deleting the role is refused before asking for confirmation, or null when it is not. */
export const roleDeletionBlocker = (_role: Role, _actor: RoleDeletionActor): RoleDeletionBlocker | null => {
    throw new Error('not implemented');
};

/** The roles of userId in the member list; empty when it is not there or userId is undefined. */
export const rolesOfMember = (_members: readonly ServerMember[], _userId: string | undefined): Role[] => {
    throw new Error('not implemented');
};
