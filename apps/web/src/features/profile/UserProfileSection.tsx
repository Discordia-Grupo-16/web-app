import { useState, useEffect, useRef, useCallback } from "react";
import type { ManualPresence } from "@discordia/api";
import { ProfilePopup } from './ProfilePopup';
import { UserProfileEditModal } from './UserProfileEditModal';
import { SecurityModal } from './SecurityModal';
import { PRESENCE_LABELS, useAuth, useManualPresence, usePresence } from "@discordia/core";
import { useParams } from "react-router-dom";
import { LogoutIcon } from "@discordia/ui";
import { presenceService, userService } from "@/shared/api";
import { readManualPresence, saveManualPresence } from "@/shared/session/manualPresence";
import { PresenceDot } from "@/shared/ui/PresenceDot";
import { useLiveRefresh } from "@/shared/hooks/useLiveRefresh"

export const UserProfileSection = () => {
    const [showProfile, setShowProfile] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [showSecurity, setShowSecurity] = useState(false)
    const { user, signOut, updateUser } = useAuth();

    // The own status is only published to the members of a server, so it is read from the open one.
    const { serverId } = useParams();
    const statuses = usePresence(serverId, presenceService.getServerPresence);
    // ProtectedRoute mounts the layout only with a user.
    const userId = user?.id ?? "";
    const rememberPresence = useCallback((manual: ManualPresence) => saveManualPresence(userId, manual), [userId]);
    const presence = useManualPresence({
        initial: readManualPresence(userId),
        observed: statuses ? (statuses.get(userId) ?? "offline") : null,
        save: presenceService.setManual,
        remember: rememberPresence,
    });
    const statusLabel = presence.manual === "invisible" ? "Invisible" : PRESENCE_LABELS[presence.status];

    const localChangeRef = useRef(0);

    const refreshProfile = useCallback(() => {
        const startedAt = localChangeRef.current;
        userService.getOwnProfile()
            .then(res => {
                if (localChangeRef.current === startedAt) {
                    updateUser(res.data);
                }
            })
            .catch(console.error);
    }, [updateUser]);

    useEffect(() => {
        refreshProfile();
    }, [refreshProfile]);

    useLiveRefresh({ resources: ['profile'], refresh: refreshProfile });

    if (!user) {
        return <div>Cargando...</div>;
    }

    return <div className="relative" style={{ background: '#292b2f' }}>
        {showProfile &&
            <ProfilePopup
                user={user}
                presence={presence}
                onClose={() => setShowProfile(false)}
                onEditProfile={() => setShowEditModal(true)}
                onOpenSecurity={() => setShowSecurity(true)}
            />
        }
        {showEditModal && (<UserProfileEditModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
        />)}
        {showSecurity && <SecurityModal onClose={() => setShowSecurity(false)} />}
        <div
            className="h-14 flex items-center px-2 gap-2 cursor-pointer transition-colors duration-150"
            style={{ background: showProfile ? 'rgba(114,137,218,0.1)' : 'transparent' }}
            onClick={() => setShowProfile(v => !v)}
            onMouseEnter={e => { if (!showProfile) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            onMouseLeave={e => { if (!showProfile) e.currentTarget.style.background = 'transparent' }}
            title="Ver perfil"
        >
            <span className="relative flex-shrink-0">
                <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden"
                    style={{ background: user.avatarUrl ? 'transparent' : '#7289da' }}
                >
                    {user.avatarUrl ? (
                        <img
                            src={user.avatarUrl}
                            alt={user.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        user.name[0].toUpperCase()
                    )}
                </div>
                <PresenceDot status={presence.status} ring="#292b2f" />
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate" style={{ fontFamily: 'Nunito, sans-serif' }}>
                    {user.name}
                </p>
                <p className="text-xs truncate" style={{ color: '#b9bbbe' }}>{statusLabel}</p>
            </div>
            <button
                onClick={e => { e.stopPropagation(); signOut() }}
                title="Cerrar sesión"
                className="p-1.5 rounded transition-colors hover:bg-white/10"
                style={{ color: '#72767d' }}
            >
                <LogoutIcon size={19} />
            </button>
        </div>
    </div>
}