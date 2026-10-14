import { Pencil, Plus, Shield } from 'lucide-react';
import { PERMISSION_COPY } from '@discordia/core';
import type { Role } from '@discordia/api';

interface RolesGroupProps {
    roles: Role[];
    canManage: boolean;
    onAdd: () => void;
    onEdit: (role: Role) => void;
}

export const RolesGroup = ({ roles, canManage, onAdd, onEdit }: RolesGroupProps) => (
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

        {roles.map(role => (
            <div
                key={role.id}
                className="group/role flex items-center gap-2 text-sm px-2 py-1.5 mx-1 rounded"
                style={{ color: '#8e9297' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#34373c')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
                <Shield size={14} style={{ flexShrink: 0 }} />
                <span className="truncate">{role.name}</span>
                {role.is_default && (
                    <span
                        className="text-xs px-1.5 rounded shrink-0"
                        style={{ background: '#40444b', color: '#99aab5' }}
                    >
                        {PERMISSION_COPY.defaultRoleBadge}
                    </span>
                )}
                <span className="flex-1" />

                {canManage && (
                    <button
                        onClick={() => onEdit(role)}
                        className="opacity-0 group-hover/role:opacity-100 transition-opacity p-1 rounded shrink-0"
                        style={{ color: '#8e9297' }}
                        title={PERMISSION_COPY.editRolePermissions(role.name)}
                        onMouseEnter={e => (e.currentTarget.style.color = '#dcddde')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#8e9297')}
                    >
                        <Pencil size={13} />
                    </button>
                )}
            </div>
        ))}
    </div>
);
