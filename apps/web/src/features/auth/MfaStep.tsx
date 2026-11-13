import { useState } from 'react';
import { useAuth } from '@discordia/core';
import { getApiErrorMessage } from '@discordia/api';

// The server deletes the mfaToken at the fifth wrong code (CA3), so there is no point in a sixth.
export const MAX_MFA_ATTEMPTS = 5;

const INVALID_CODE = 'El código no es válido';

const statusOf = (err: unknown) => (err as { response?: { status?: number } })?.response?.status;

interface MfaStepProps {
    /** Called once the session is open. `recoveryCodesRemaining` is set when a recovery code was spent. */
    onVerified: (recoveryCodesRemaining?: number) => void;
}

export const MfaStep = ({ onVerified }: MfaStepProps) => {
    const { completeMfa, cancelMfa } = useAuth();
    const [useRecovery, setUseRecovery] = useState(false);
    const [value, setValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [attempts, setAttempts] = useState(0);

    const switchMode = () => {
        setUseRecovery((v) => !v);
        setValue('');
        setError(null);
    };

    const handleChange = (raw: string) => {
        setValue(useRecovery ? raw.trim().toLowerCase() : raw.replace(/\D/g, '').slice(0, 6));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const valid = useRecovery ? /^[a-z0-9]{4}-[a-z0-9]{4}$/.test(value) : /^\d{6}$/.test(value);
        if (!valid) {
            setError(
                useRecovery
                    ? 'El código de recuperación tiene el formato xxxx-xxxx.'
                    : 'El código tiene 6 dígitos.',
            );
            return;
        }

        setLoading(true);
        try {
            const { recoveryCodesRemaining } = await completeMfa(
                useRecovery ? { recoveryCode: value } : { code: value },
            );
            onVerified(recoveryCodesRemaining);
        } catch (err: unknown) {
            const status = statusOf(err);
            const used = attempts + 1;
            setAttempts(used);
            if (status === 400 || status === 401) {
                if (used >= MAX_MFA_ATTEMPTS) {
                    // Back to the login: the server already threw the token away.
                    cancelMfa();
                    return;
                }
                setError(INVALID_CODE);
            } else {
                setError(getApiErrorMessage(err, INVALID_CODE));
            }
            setValue('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="rounded-2xl p-8 shadow-2xl" style={{ background: '#2c2f33' }}>
                <div className="mb-8 text-center">
                    <h2 className="text-2xl font-black mb-1" style={{ fontFamily: 'Nunito, sans-serif', color: '#ffffff' }}>
                        Verificación en dos pasos
                    </h2>
                    <p className="text-sm" style={{ fontFamily: 'Open Sans, sans-serif', color: '#99aab5' }}>
                        {useRecovery
                            ? 'Ingresá uno de tus códigos de recuperación.'
                            : 'Ingresá el código de tu app autenticadora.'}
                    </p>
                </div>

                {error && (
                    <div
                        role="alert"
                        className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium"
                    >
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                    <div>
                        <label
                            htmlFor="mfa-input"
                            className="block text-xs font-semibold uppercase tracking-wider mb-2"
                            style={{ fontFamily: 'Open Sans, sans-serif', color: '#99aab5' }}
                        >
                            {useRecovery ? 'Código de recuperación' : 'Código de verificación'}
                        </label>
                        <input
                            id="mfa-input"
                            type="text"
                            inputMode={useRecovery ? 'text' : 'numeric'}
                            autoComplete="one-time-code"
                            autoFocus
                            value={value}
                            onChange={(e) => handleChange(e.target.value)}
                            placeholder={useRecovery ? 'xxxx-xxxx' : '000000'}
                            className="w-full px-4 py-3 rounded-lg text-sm tracking-widest text-center outline-none"
                            style={{ background: '#23272a', color: '#ffffff', fontFamily: 'Open Sans, sans-serif' }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-lg text-sm font-bold"
                        style={{
                            background: loading ? '#5b6eae' : '#7289da',
                            color: '#ffffff',
                            fontFamily: 'Open Sans, sans-serif',
                            cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {loading ? 'Verificando…' : 'Verificar'}
                    </button>
                </form>

                <div className="mt-5 flex flex-col items-center gap-2 text-sm" style={{ fontFamily: 'Open Sans, sans-serif' }}>
                    <button type="button" onClick={switchMode} className="font-semibold hover:underline" style={{ color: '#7289da' }}>
                        {useRecovery ? 'Usar el código de la app' : 'Usar un código de recuperación'}
                    </button>
                    <button type="button" onClick={cancelMfa} className="hover:underline" style={{ color: '#99aab5' }}>
                        Volver al inicio de sesión
                    </button>
                </div>
            </div>
        </div>
    );
};

interface RecoveryNoticeProps {
    remaining: number;
    onContinue: () => void;
}

/** CA4: shown after a recovery code was spent, before entering the app. */
export const RecoveryNotice = ({ remaining, onContinue }: RecoveryNoticeProps) => (
    <div className="w-full max-w-md mx-auto">
        <div className="rounded-2xl p-8 shadow-2xl text-center" style={{ background: '#2c2f33' }}>
            <h2 className="text-2xl font-black mb-3" style={{ fontFamily: 'Nunito, sans-serif', color: '#ffffff' }}>
                Entraste con un código de recuperación
            </h2>
            <p role="status" className="text-sm mb-6" style={{ fontFamily: 'Open Sans, sans-serif', color: '#99aab5' }}>
                {remaining === 1
                    ? 'Te queda 1 código. Te recomendamos generar nuevos desde Seguridad, en tu perfil.'
                    : `Te quedan ${remaining} códigos. Te recomendamos generar nuevos desde Seguridad, en tu perfil.`}
            </p>
            <button
                type="button"
                onClick={onContinue}
                className="w-full py-3 rounded-lg text-sm font-bold"
                style={{ background: '#7289da', color: '#ffffff', fontFamily: 'Open Sans, sans-serif' }}
            >
                Continuar
            </button>
        </div>
    </div>
);
