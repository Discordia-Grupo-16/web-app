import { useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { invitationsService } from '../../services/communityServices';
import type { Invitation } from '@discordia/api';

interface Props {
    serverId: string;
    onClose: () => void;
}

const EXPIRY_OPTIONS = [
    { label: 'Sin expiración', value: undefined as number | undefined },
    { label: '1 hora', value: 1 },
    { label: '6 horas', value: 6 },
    { label: '24 horas', value: 24 },
    { label: '7 días', value: 168 },
];

export const InviteModal = ({ serverId, onClose }: Props) => {
    const [expiresIndex, setExpiresIndex] = useState(3);
    const [maxUses, setMaxUses] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [invitation, setInvitation] = useState<Invitation | null>(null);
    const [copied, setCopied] = useState(false);

    const inviteLink = invitation
        ? `${window.location.origin}/invite/${invitation.code}`
        : '';

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        try {
            const expiresInHours = EXPIRY_OPTIONS[expiresIndex].value;
            const maxUsesNum = maxUses ? parseInt(maxUses) : undefined;
            const inv = await invitationsService.createInvitation(serverId, expiresInHours, maxUsesNum);
            setInvitation(inv);
        } catch (err) {
            const error = err as { response?: { data?: { detail?: string } } };
            const detail = error.response?.data?.detail;
            setError(detail || 'Error al generar la invitación');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 transition-colors"
                    style={{ color: '#99aab5' }}
                >
                    <X size={20} />
                </button>

                <h2
                    className="text-2xl font-black text-white text-center mb-1"
                    style={{ fontFamily: 'Nunito, sans-serif' }}
                >
                    Invitar personas
                </h2>
                <p className="text-sm text-center mb-6" style={{ color: '#99aab5' }}>
                    Compartí el link para que otros puedan unirse al servidor.
                </p>

                {!invitation ? (
                    <div className="space-y-4">
                        <div>
                            <label
                                className="block text-xs font-semibold uppercase tracking-wider mb-2"
                                style={{ color: '#99aab5' }}
                            >
                                Expiración
                            </label>
                            <select
                                value={expiresIndex}
                                onChange={e => setExpiresIndex(Number(e.target.value))}
                                className="w-full px-4 py-3 rounded-lg text-sm text-white outline-none"
                                style={{ background: '#23272a', border: '1.5px solid transparent' }}
                            >
                                {EXPIRY_OPTIONS.map((opt, i) => (
                                    <option key={i} value={i}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label
                                className="block text-xs font-semibold uppercase tracking-wider mb-2"
                                style={{ color: '#99aab5' }}
                            >
                                Límite de usos{' '}
                                <span className="normal-case font-normal">(opcional)</span>
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={maxUses}
                                onChange={e => setMaxUses(e.target.value)}
                                placeholder="Sin límite"
                                className="w-full px-4 py-3 rounded-lg text-sm text-white outline-none placeholder-gray-500"
                                style={{ background: '#23272a', border: '1.5px solid transparent' }}
                                onFocus={e => e.currentTarget.style.borderColor = '#7289da'}
                                onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
                            />
                        </div>

                        {error && <p className="text-sm" style={{ color: '#ed4245' }}>{error}</p>}

                        <button
                            onClick={handleGenerate}
                            disabled={loading}
                            className="w-full py-3 rounded-lg text-sm font-bold text-white transition-all duration-200"
                            style={{
                                background: loading ? '#5b6eae' : '#7289da',
                                cursor: loading ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {loading ? 'Generando...' : 'Generar invitación'}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label
                                className="block text-xs font-semibold uppercase tracking-wider mb-2"
                                style={{ color: '#99aab5' }}
                            >
                                Link de invitación
                            </label>
                            <div
                                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                                style={{ background: '#23272a' }}
                            >
                                <span className="flex-1 text-sm text-white truncate">{inviteLink}</span>
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold text-white transition-colors shrink-0"
                                    style={{ background: copied ? '#43b581' : '#7289da' }}
                                >
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                    {copied ? 'Copiado' : 'Copiar'}
                                </button>
                            </div>
                        </div>

                        <div className="text-xs space-y-1" style={{ color: '#99aab5' }}>
                            {invitation.expires_at && (
                                <p>Expira: {new Date(invitation.expires_at).toLocaleString()}</p>
                            )}
                            {invitation.max_uses && (
                                <p>Límite: {invitation.max_uses} uso{invitation.max_uses > 1 ? 's' : ''}</p>
                            )}
                            {!invitation.expires_at && !invitation.max_uses && (
                                <p>Este link no expira y no tiene límite de usos.</p>
                            )}
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full py-3 rounded-lg text-sm font-bold transition-all duration-200"
                            style={{ background: '#4f545c', color: '#dcddde' }}
                        >
                            Listo
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
