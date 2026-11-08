import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { serversService } from '@/shared/api';
import type { Server } from '@discordia/api';

interface Props {
    server: Server;
    onClose: () => void;
    onUpdated: (server: Server) => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 8 * 1024 * 1024;

const validateImage = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) return 'Formato no válido. Usá JPG, PNG, GIF o WEBP.';
    if (file.size > MAX_SIZE) return 'La imagen no puede superar los 8 MB.';
    return null;
};

export const EditServerModal = ({ server, onClose, onUpdated }: Props) => {
    const [name, setName] = useState(server.name);
    const [description, setDescription] = useState(server.description ?? '');
    const [icon, setIcon] = useState<File | null>(null);
    const [banner, setBanner] = useState<File | null>(null);
    const [iconRejected, setIconRejected] = useState<string | null>(null);
    const [bannerRejected, setBannerRejected] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const iconRef = useRef<HTMLInputElement>(null);
    const bannerRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (
        e: React.ChangeEvent<HTMLInputElement>,
        setter: (f: File | null) => void,
        setRejected: (name: string | null) => void,
    ) => {
        const file = e.target.files?.[0] ?? null;
        if (!file) return;
        const err = validateImage(file);
        if (err) { setError(err); setter(null); setRejected(file.name); e.target.value = ''; return; }
        setError(null);
        setRejected(null);
        setter(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const updated = await serversService.updateServer(server.id, {
                name,
                description: description !== (server.description ?? '') ? description : undefined,
                icon: icon ?? undefined,
                banner: banner ?? undefined,
            });
            onUpdated(updated);
            onClose();
        } catch (err) {
            const e = err as { response?: { data?: { detail?: string } } };
            setError(e.response?.data?.detail ?? 'Error al guardar los cambios');
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
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 transition-colors"
                    style={{ color: '#99aab5' }}
                >
                    <X size={20} />
                </button>

                <h2
                    className="text-xl font-black text-white mb-6"
                    style={{ fontFamily: 'Nunito, sans-serif' }}
                >
                    Configuración del servidor
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label
                            className="block text-xs font-semibold uppercase tracking-wider mb-2"
                            style={{ color: '#99aab5' }}
                        >
                            Nombre del servidor *
                        </label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            className="w-full px-4 py-3 rounded-lg text-sm text-white outline-none"
                            style={{ background: '#23272a', border: '1.5px solid transparent' }}
                            onFocus={e => (e.currentTarget.style.borderColor = '#7289da')}
                            onBlur={e => (e.currentTarget.style.borderColor = 'transparent')}
                        />
                    </div>

                    <div>
                        <label
                            className="block text-xs font-semibold uppercase tracking-wider mb-2"
                            style={{ color: '#99aab5' }}
                        >
                            Descripción
                        </label>
                        <input
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Descripción opcional"
                            className="w-full px-4 py-3 rounded-lg text-sm text-white outline-none placeholder-gray-500"
                            style={{ background: '#23272a', border: '1.5px solid transparent' }}
                            onFocus={e => (e.currentTarget.style.borderColor = '#7289da')}
                            onBlur={e => (e.currentTarget.style.borderColor = 'transparent')}
                        />
                    </div>

                    <div>
                        <label
                            className="block text-xs font-semibold uppercase tracking-wider mb-2"
                            style={{ color: '#99aab5' }}
                        >
                            Ícono {icon && <span style={{ color: '#43b581' }}>· {icon.name}</span>}{iconRejected && <span style={{ color: '#ed4245' }}>· {iconRejected}</span>}
                        </label>
                        <button
                            type="button"
                            onClick={() => iconRef.current?.click()}
                            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                            style={{ background: '#4f545c', color: '#fff' }}
                        >
                            Elegir imagen
                        </button>
                        <input
                            ref={iconRef}
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            className="hidden"
                            onChange={e => handleFileChange(e, setIcon, setIconRejected)}
                        />
                    </div>

                    <div>
                        <label
                            className="block text-xs font-semibold uppercase tracking-wider mb-2"
                            style={{ color: '#99aab5' }}
                        >
                            Banner {banner && <span style={{ color: '#43b581' }}>· {banner.name}</span>}{bannerRejected && <span style={{ color: '#ed4245' }}>· {bannerRejected}</span>}
                        </label>
                        <button
                            type="button"
                            onClick={() => bannerRef.current?.click()}
                            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                            style={{ background: '#4f545c', color: '#fff' }}
                        >
                            Elegir imagen
                        </button>
                        <input
                            ref={bannerRef}
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            className="hidden"
                            onChange={e => handleFileChange(e, setBanner, setBannerRejected)}
                        />
                    </div>

                    {error && <p className="text-sm" style={{ color: '#ed4245' }}>{error}</p>}

                    <button
                        type="submit"
                        disabled={loading || !name.trim() || !!error}
                        className="w-full py-3 rounded-lg text-sm font-bold text-white transition-all duration-200"
                        style={{
                            background: loading || !name.trim() ? '#5b6eae' : '#7289da',
                            cursor: loading || !name.trim() ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {loading ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                </form>
            </div>
        </div>
    );
};
