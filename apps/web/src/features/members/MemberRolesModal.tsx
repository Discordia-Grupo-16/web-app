import { useState } from 'react';
import { X } from 'lucide-react';
import { getErrorDetail, type Role, type ServerMember } from '@discordia/api';
import { rolesService } from '@/shared/api';

interface Props {
    serverId: string;
    member: ServerMember;
    memberName: string;
    roles: Role[];
    onClose: () => void;
    onRolesChange: (userId: string, roles: Role[]) => void;
}

/**
 * Gives and takes the roles of one member (SCRUM-62).
 *
 * Each tick is sent on its own instead of being collected behind a save
 * button: the API has one endpoint per role, both idempotent, and a button
 * would have to diff the two states and fire the same calls anyway — with the
 * added problem of a half-applied save if one of them is refused.
 */
export const MemberRolesModal = ({
    serverId,
    member,
    memberName,
    roles,
    onClose,
    onRolesChange,
}: Props) => {
    const [pending, setPending] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const has = (roleId: string) => member.roles.some(role => role.id === roleId);

    const toggle = async (role: Role, enabled: boolean) => {
        setPending(role.id);
        setError(null);
        try {
            if (enabled) {
                await rolesService.assignRole(serverId, role.id, member.user_id);
                onRolesChange(member.user_id, [...member.roles, role]);
            } else {
                await rolesService.removeRole(serverId, role.id, member.user_id);
                onRolesChange(
                    member.user_id,
                    member.roles.filter(r => r.id !== role.id),
                );
            }
        } catch (err) {
            // The hierarchy is the backend's: it knows the roles of the caller and of the
            // target, and this screen does not. The list is left untouched, so the tick
            // goes back to what the server still holds.
            setError(getErrorDetail(err) ?? 'No se pudo cambiar el rol');
        } finally {
            setPending(null);
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
                    Roles del miembro
                </h2>
                <p className="text-sm mb-6" style={{ color: '#99aab5' }}>
                    {memberName}
                </p>

                {roles.length === 0 ? (
                    <p className="text-sm" style={{ color: '#99aab5' }}>
                        Este servidor todavía no tiene roles. Creá uno para poder asignarlo.
                    </p>
                ) : (
                    <div className="space-y-1 max-h-80 overflow-y-auto -mx-2 px-2">
                        {roles.map(role => (
                            <label
                                key={role.id}
                                className="flex gap-3 items-center py-2 px-2 rounded cursor-pointer"
                                onMouseEnter={e => (e.currentTarget.style.background = '#34373c')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <input
                                    type="checkbox"
                                    checked={has(role.id)}
                                    disabled={pending !== null}
                                    onChange={e => toggle(role, e.target.checked)}
                                    aria-label={role.name}
                                    className="shrink-0"
                                    style={{ accentColor: '#7289da' }}
                                />
                                <span className="text-sm text-white truncate">{role.name}</span>
                            </label>
                        ))}
                    </div>
                )}

                {error && (
                    <p role="alert" className="text-sm mt-4" style={{ color: '#ed4245' }}>
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
};
