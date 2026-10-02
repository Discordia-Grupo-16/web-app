import { useState } from 'react';
import { X } from 'lucide-react';
import { serversService } from '@/shared/api';
import type { Server } from '@discordia/api';

interface Props {
    onClose: () => void;
    onCreated: (server: Server) => void;
}

export const CreateServerModal = ({ onClose, onCreated }: Props) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const server = await serversService.createServer(name, description || undefined);
            onCreated(server);
        } catch (err) {
            const error = err as { response?: { data?: { detail?: string } } };
            const detail = error.response?.data?.detail;
            setError(detail || 'Error al crear el servidor');
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

                <h2
                    className="text-2xl font-black text-white text-center mb-1"
                    style={{ fontFamily: 'Nunito, sans-serif' }}
                >
                    Crear un servidor
                </h2>
                <p className="text-sm text-center mb-6" style={{ color: '#99aab5' }}>
                    Tu servidor es donde vos y tus amigos se juntan.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#99aab5' }}>
                            Nombre del servidor *
                        </label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            placeholder="Mi servidor"
                            className="w-full px-4 py-3 rounded-lg text-sm text-white outline-none placeholder-gray-500"
                            style={{ background: '#23272a', border: '1.5px solid transparent' }}
                            onFocus={e => e.currentTarget.style.borderColor = '#7289da'}
                            onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#99aab5' }}>
                            Descripción
                        </label>
                        <input
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Opcional"
                            className="w-full px-4 py-3 rounded-lg text-sm text-white outline-none placeholder-gray-500"
                            style={{ background: '#23272a', border: '1.5px solid transparent' }}
                            onFocus={e => e.currentTarget.style.borderColor = '#7289da'}
                            onBlur={e => e.currentTarget.style.borderColor = 'transparent'}
                        />
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
                        {loading ? 'Creando...' : 'Crear servidor'}
                    </button>
                </form>
            </div>
        </div>
    );
};
