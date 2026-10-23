import { X } from 'lucide-react';

interface Props {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmModal = ({
    title,
    message,
    confirmLabel = 'Confirmar',
    danger = false,
    onConfirm,
    onCancel,
}: Props) => (
    <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.7)' }}
        onClick={onCancel}
    >
        <div
            className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ background: '#36393f' }}
            onClick={e => e.stopPropagation()}
        >
            <button
                onClick={onCancel}
                className="absolute top-4 right-4 transition-colors"
                style={{ color: '#99aab5' }}
            >
                <X size={18} />
            </button>

            <h2 className="text-lg font-black text-white mb-2">{title}</h2>
            <p className="text-sm mb-6" style={{ color: '#99aab5' }}>{message}</p>

            <div className="flex gap-3 justify-end">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                    style={{ color: '#99aab5', background: '#2c2f33' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#3d4045')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#2c2f33')}
                >
                    Cancelar
                </button>
                <button
                    onClick={onConfirm}
                    className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors"
                    style={{ background: danger ? '#ed4245' : '#7289da' }}
                    onMouseEnter={e => (e.currentTarget.style.background = danger ? '#c0393b' : '#5b73c0')}
                    onMouseLeave={e => (e.currentTarget.style.background = danger ? '#ed4245' : '#7289da')}
                >
                    {confirmLabel}
                </button>
            </div>
        </div>
    </div>
);
