import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { serversService } from '@/shared/api';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';

export const LeaveServerButton = ({ serverId }: { serverId: string }) => {
    const navigate = useNavigate();
    const [pendingLeave, setPendingLeave] = useState(false);

    const confirmLeave = async () => {
        setPendingLeave(false);
        try {
            await serversService.leaveServer(serverId);
            navigate('/');
        } catch (err) {
            const error = err as { response?: { data?: { detail?: string } } };
            const detail = error.response?.data?.detail;

            window.alert(detail || 'Error al abandonar el servidor');
        }
    };

    return (
        <>
            <div
                className="flex items-center px-3 py-2"
                style={{ borderTop: '1px solid #202225', background: '#292b2f' }}
            >
                <button
                    onClick={() => setPendingLeave(true)}
                    className="flex items-center gap-2 text-xs px-2 py-1 rounded w-full transition-colors"
                    style={{ color: '#ed4245' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(237,66,69,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                    <LogOut size={14} />
                    Abandonar servidor
                </button>
            </div>

            {pendingLeave && (
                <ConfirmModal
                    title="Abandonar servidor"
                    message="¿Seguro que querés salir de este servidor?"
                    confirmLabel="Abandonar"
                    danger
                    onConfirm={confirmLeave}
                    onCancel={() => setPendingLeave(false)}
                />
            )}
        </>
    );
};
