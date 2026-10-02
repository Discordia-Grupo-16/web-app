import { Plus, Shield } from 'lucide-react';
import type { Role } from '@discordia/api';

interface RolesGroupProps {
    roles: Role[];
    canManage: boolean;
    onAdd: () => void;
}

export const RolesGroup = ({ roles, canManage, onAdd }: RolesGroupProps) => (
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
                className="flex items-center gap-2 text-sm px-2 py-1.5 mx-1 rounded"
                style={{ color: '#8e9297' }}
            >
                <Shield size={14} style={{ flexShrink: 0 }} />
                <span className="truncate">{role.name}</span>
            </div>
        ))}
    </div>
);
