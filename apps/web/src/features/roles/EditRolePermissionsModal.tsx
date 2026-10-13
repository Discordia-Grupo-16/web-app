import { useState } from 'react';
import { X } from 'lucide-react';
import {
    ADMINISTRATOR,
    PERMISSION_BY_NAME,
    PERMISSION_COPY,
    PERMISSION_HINT,
    PERMISSION_LABEL,
    PERMISSION_ORDER,
    hasPermission,
    togglePermission,
    toPermissionNames,
} from '@discordia/core';
import { getErrorDetail, type Role } from '@discordia/api';
import { rolesService } from '@/shared/api';

interface Props {
    serverId: string;
    role: Role;
    onClose: () => void;
    onUpdated: (role: Role) => void;
}

export const EditRolePermissionsModal = ({ serverId, role, onClose, onUpdated }: Props) => {
    const [permissions, setPermissions] = useState(role.permissions);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isAdministrator = hasPermission(permissions, ADMINISTRATOR);
    const unchanged = permissions === role.permissions;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const updated = await rolesService.updateRolePermissions(
                serverId,
                role.id,
                toPermissionNames(permissions),
            );
            onUpdated(updated);
        } catch (err) {
            // The hierarchy lives in the backend: it knows which roles the caller has and
            // this screen does not, so a role above the caller's own is rejected here with
            // the reason it gives.
            setError(getErrorDetail(err) ?? PERMISSION_COPY.rolePermissionsError);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-md rounded-2xl p-8 shadow-2xl"
                style={{ background: '#36393f' }}
                onClick={e => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-4 right-4 transition-colors" style={{ color: '#99aab5' }}>
                    <X size={20} />
                </button>

                <h2 className="text-xl font-black text-white mb-1" style={{ fontFamily: 'Nunito, sans-serif' }}>
                    {PERMISSION_COPY.rolePermissionsTitle}
                </h2>
                <p className="text-sm mb-6" style={{ color: '#99aab5' }}>
                    {role.name}
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-1 max-h-80 overflow-y-auto -mx-2 px-2">
                        {PERMISSION_ORDER.map(name => {
                            const bit = PERMISSION_BY_NAME[name];
                            return (
                                <label
                                    key={name}
                                    className="flex gap-3 items-start py-2 px-2 rounded cursor-pointer"
                                    onMouseEnter={e => (e.currentTarget.style.background = '#34373c')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <input
                                        type="checkbox"
                                        checked={hasPermission(permissions, bit)}
                                        onChange={e =>
                                            setPermissions(prev => togglePermission(prev, bit, e.target.checked))
                                        }
                                        aria-label={PERMISSION_LABEL[name]}
                                        className="mt-0.5 shrink-0"
                                        style={{ accentColor: '#7289da' }}
                                    />
                                    <span className="min-w-0">
                                        <span className="block text-sm text-white">{PERMISSION_LABEL[name]}</span>
                                        <span className="block text-xs mt-0.5" style={{ color: '#99aab5' }}>
                                            {PERMISSION_HINT[name]}
                                        </span>
                                    </span>
                                </label>
                            );
                        })}
                    </div>

                    {isAdministrator && (
                        <p role="status" className="text-xs mt-4" style={{ color: '#faa61a' }}>
                            {PERMISSION_COPY.administratorNotice}
                        </p>
                    )}

                    {error && (
                        <p role="alert" className="text-sm mt-4" style={{ color: '#ed4245' }}>
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading || unchanged}
                        className="w-full mt-6 py-3 rounded-lg text-sm font-bold text-white transition-all duration-200"
                        style={{
                            background: loading || unchanged ? '#5b6eae' : '#7289da',
                            cursor: loading || unchanged ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {loading ? PERMISSION_COPY.saving : PERMISSION_COPY.save}
                    </button>
                </form>
            </div>
        </div>
    );
};
