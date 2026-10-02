import { useState } from 'react';
import { Hash, Volume2, X } from 'lucide-react';
import { channelsService } from '@/shared/api';
import type { Channel } from '@discordia/api';

interface Props {
    serverId: string;
    type: 'text' | 'voice';
    onClose: () => void;
    onCreated: (channel: Channel) => void;
}

export const CreateChannelModal = ({ serverId, type, onClose, onCreated }: Props) => {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const channel = await channelsService.createChannel(serverId, name, type);
            onCreated(channel);
        } catch (err) {
            const error = err as { response?: { data?: { detail?: string } } };
            const detail = error.response?.data?.detail;
            setError(detail || 'Error al crear el canal');
        } finally {
            setLoading(false);
        }
    };

    // Discord normaliza el nombre: minúsculas, espacios → guiones
    const handleNameChange = (value: string) =>
        setName(value.toLowerCase().replace(/\s+/g, '-'));

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
                    Crear canal
                </h2>
                <p className="text-sm mb-6" style={{ color: '#99aab5' }}>
                    Canal de {type === 'text' ? 'texto' : 'voz'}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#99aab5' }}>
                            Nombre del canal *
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8e9297' }}>
                                {type === 'text' ? <Hash size={16} /> : <Volume2 size={16} />}
                            </span>
                            <input
                                value={name}
                                onChange={e => handleNameChange(e.target.value)}
                                required
                                placeholder={type === 'text' ? 'nuevo-canal' : 'voz-general'}
                                className="w-full pl-8 pr-4 py-3 rounded-lg text-sm text-white outline-none placeholder-gray-500"
                                style={{ background: '#23272a', border: '1.5px solid transparent' }}
                                onFocus={e => e.currentTarget.style.borderColor = '#7289da'}
                                onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
                            />
                        </div>
                    </div>

                    {error && <p className="text-sm" style={{ color: '#ed4245' }}>{error}</p>}

                    <button
                        type="submit"
                        disabled={loading || !name.trim()}
                        className="w-full py-3 rounded-lg text-sm font-bold text-white transition-all duration-200"
                        style={{
                            background: loading || !name.trim() ? '#5b6eae' : '#7289da',
                            cursor: loading || !name.trim() ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {loading ? 'Creando...' : 'Crear canal'}
                    </button>
                </form>
            </div>
        </div>
    );
};
