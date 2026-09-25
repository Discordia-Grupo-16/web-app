import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { joinServer } from '../services/invitationsService';

type Status = 'loading' | 'success' | 'error';

const ERROR_MESSAGES: Record<number, string> = {
    404: 'La invitación no existe.',
    410: 'Esta invitación ya no es válida (expirada o sin usos disponibles).',
    403: 'No podés unirte a este servidor.',
};

export const InvitePage = () => {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const [status, setStatus] = useState<Status>('loading');
    const [serverId, setServerId] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (!code) return;
        joinServer(code)
            .then(member => {
                setServerId(member.server_id);
                setStatus('success');
            })
            .catch(err => {
                const statusCode: number = err?.response?.status;
                setErrorMsg(ERROR_MESSAGES[statusCode] ?? 'Ocurrió un error al procesar la invitación.');
                setStatus('error');
            });
    }, [code]);

    return (
        <div
            className="fixed inset-0 flex items-center justify-center"
            style={{ background: '#36393f' }}
        >
            <div
                className="text-center rounded-2xl p-10 shadow-2xl max-w-sm w-full"
                style={{ background: '#2f3136' }}
            >
                {status === 'loading' && (
                    <>
                        <div
                            className="w-12 h-12 rounded-full border-4 animate-spin mx-auto mb-4"
                            style={{ borderColor: '#7289da', borderTopColor: 'transparent' }}
                        />
                        <p className="text-white font-semibold">Procesando invitación...</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div
                            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold"
                            style={{ background: '#43b581' }}
                        >
                            ✓
                        </div>
                        <h2 className="text-xl font-black text-white mb-2">¡Te uniste al servidor!</h2>
                        <p className="text-sm mb-6" style={{ color: '#99aab5' }}>
                            Ya sos miembro.
                        </p>
                        <button
                            onClick={() => navigate(`/servers/${serverId}`)}
                            className="px-6 py-3 rounded-lg text-sm font-bold text-white"
                            style={{ background: '#7289da' }}
                        >
                            Ir al servidor
                        </button>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div
                            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold"
                            style={{ background: '#ed4245' }}
                        >
                            ✕
                        </div>
                        <h2 className="text-xl font-black text-white mb-2">Invitación inválida</h2>
                        <p className="text-sm mb-6" style={{ color: '#99aab5' }}>
                            {errorMsg}
                        </p>
                        <button
                            onClick={() => navigate('/')}
                            className="px-6 py-3 rounded-lg text-sm font-bold"
                            style={{ background: '#4f545c', color: '#dcddde' }}
                        >
                            Ir al inicio
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
