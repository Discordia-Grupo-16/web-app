import { Pencil, Plus, Shield, Trash2, Users } from 'lucide-react';
import { PERMISSION_COPY, ROLE_DELETION_TEXTS } from '@discordia/core';
import type { Role } from '@discordia/api';

interface RolesGroupProps {
    roles: Role[];
    canManage: boolean;
    onAdd: () => void;
    onEdit: (role: Role) => void;
    onViewMembers: (role: Role) => void;
    /** Whether "Eliminar" is offered on the role (SCRUM-64). */
    canDelete: (role: Role) => boolean;
    onDelete: (role: Role) => void;
}

export const RolesGroup = ({
    roles,
    canManage,
    onAdd,
    onEdit,
    onViewMembers,
    canDelete,
    onDelete,
}: RolesGroupProps) => (
    <div className="mb-4">
        <div className="flex items-center justify-between px-2 py-1 group">
            <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: '#8e9297' }}
            >
                Roles
            </span>
            {canManage && (
                <button
                    onClick={onAdd}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                    style={{ color: '#8e9297' }}
                    title="Crear rol"
                >
                    <Plus size={14} />
                </button>
            )}
        </div>

        {roles.map(role => {
            const canDeleteRole = canDelete(role);
            const hasActions = canManage || canDeleteRole;

            return (
                <div
                    key={role.id}
                    className="group/role relative flex flex-col text-sm px-2 py-1.5 mx-1 rounded"
                    style={{ color: '#8e9297' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#34373c')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                    {/* First line: the name gives way (ellipsis) before the "Por defecto" badge does. */}
                    <div className="flex items-center gap-2 min-w-0">
                        <Shield size={14} style={{ flexShrink: 0 }} />
                        <span className="truncate min-w-0">{role.name}</span>
                        {role.is_default && (
                            <span
                                className="text-xs px-1.5 rounded shrink-0"
                                style={{ background: '#40444b', color: '#99aab5' }}
                            >
                                {PERMISSION_COPY.defaultRoleBadge}
                            </span>
                        )}
                    </div>

                    {/* Out of the row's flow: with hover they float over its right side, so they take no
                        width from the name. Without hover (touch), they sit in a second line. */}
                    {hasActions && (
                        <div
                            data-testid={`role-actions-${role.id}`}
                            className="absolute right-1 top-1.5 flex items-center gap-0.5 rounded px-1 bg-[#34373c] opacity-0 pointer-events-none transition-opacity group-hover/role:opacity-100 group-hover/role:pointer-events-auto group-focus-within/role:opacity-100 group-focus-within/role:pointer-events-auto [@media(hover:none)]:static [@media(hover:none)]:flex-wrap [@media(hover:none)]:mt-1 [@media(hover:none)]:px-0 [@media(hover:none)]:bg-transparent [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto"
                        >
                            {canManage && (
                                <button
                                    onClick={() => onViewMembers(role)}
                                    className="p-1 rounded shrink-0"
                                    style={{ color: '#8e9297' }}
                                    title={PERMISSION_COPY.viewRoleMembers(role.name)}
                                    onMouseEnter={e => (e.currentTarget.style.color = '#dcddde')}
                                    onMouseLeave={e => (e.currentTarget.style.color = '#8e9297')}
                                >
                                    <Users size={13} />
                                </button>
                            )}

                            {canManage && (
                                <button
                                    onClick={() => onEdit(role)}
                                    className="p-1 rounded shrink-0"
                                    style={{ color: '#8e9297' }}
                                    title={PERMISSION_COPY.editRolePermissions(role.name)}
                                    onMouseEnter={e => (e.currentTarget.style.color = '#dcddde')}
                                    onMouseLeave={e => (e.currentTarget.style.color = '#8e9297')}
                                >
                                    <Pencil size={13} />
                                </button>
                            )}

                            {canDeleteRole && (
                                <button
                                    onClick={() => onDelete(role)}
                                    className="p-1 rounded shrink-0"
                                    style={{ color: '#8e9297' }}
                                    title={ROLE_DELETION_TEXTS.actionLabel(role.name)}
                                    aria-label={ROLE_DELETION_TEXTS.actionLabel(role.name)}
                                    onMouseEnter={e => (e.currentTarget.style.color = '#ed4245')}
                                    onMouseLeave={e => (e.currentTarget.style.color = '#8e9297')}
                                >
                                    <Trash2 size={13} />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            );
        })}
    </div>
);
