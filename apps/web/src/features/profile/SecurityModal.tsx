import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getApiErrorMessage } from '@discordia/api';
import { mfaService } from '@/shared/api';

type Step =
    | { name: 'menu' }
    | { name: 'enable'; secret: string; otpauthUri: string }
    | { name: 'regenerate' }
    | { name: 'disable' }
    | { name: 'codes'; codes: string[] }
    | { name: 'done'; message: string };

const statusOf = (err: unknown) => (err as { response?: { status?: number } })?.response?.status;

const fieldStyle = {
    background: '#23272a',
    color: '#ffffff',
    fontFamily: 'Open Sans, sans-serif',
} as const;

const primaryButton = 'w-full py-2.5 rounded-lg text-sm font-bold text-white cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';

interface SecurityModalProps {
    onClose: () => void;
}

export const SecurityModal = ({ onClose }: SecurityModalProps) => {
    const [step, setStep] = useState<Step>({ name: 'menu' });
    const [value, setValue] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const goTo = (next: Step) => {
        setStep(next);
        setValue('');
        setError(null);
        setCopied(false);
    };

    const run = async (action: () => Promise<void>, messages: Record<number, string> = {}) => {
        setBusy(true);
        setError(null);
        try {
            await action();
        } catch (err: unknown) {
            const status = statusOf(err);
            setError((status && messages[status]) || getApiErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const startSetup = () =>
        run(
            async () => {
                const { secret, otpauthUri } = await mfaService.setup();
                goTo({ name: 'enable', secret, otpauthUri });
            },
            { 409: 'La verificación en dos pasos ya está activa. Podés generar códigos nuevos o desactivarla.' },
        );

    const submitCode = (kind: 'enable' | 'regenerate') => (e: React.FormEvent) => {
        e.preventDefault();
        if (!/^\d{6}$/.test(value)) {
            setError('El código tiene 6 dígitos.');
            return;
        }
        void run(
            async () => {
                const { recoveryCodes } =
                    kind === 'enable'
                        ? await mfaService.enable(value)
                        : await mfaService.regenerateRecoveryCodes(value);
                goTo({ name: 'codes', codes: recoveryCodes });
            },
            {
                400: 'El código no es válido',
                409: kind === 'enable' ? 'La verificación en dos pasos ya está activa.' : 'La verificación en dos pasos no está activa.',
            },
        );
    };

    const submitDisable = (e: React.FormEvent) => {
        e.preventDefault();
        if (!value) {
            setError('Ingresá tu contraseña.');
            return;
        }
        void run(
            async () => {
                await mfaService.disable(value);
                goTo({ name: 'done', message: 'Desactivaste la verificación en dos pasos.' });
            },
            {
                401: 'La contraseña es incorrecta',
                409: 'La verificación en dos pasos no está activa, o tu cuenta no tiene contraseña.',
            },
        );
    };

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
        } catch {
            setError('No pudimos copiar. Seleccioná el texto y copialo a mano.');
        }
    };

    const download = (codes: string[]) => {
        const blob = new Blob([`Códigos de recuperación de Discordia\n\n${codes.join('\n')}\n`], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'discordia-codigos-de-recuperacion.txt';
        link.click();
        URL.revokeObjectURL(url);
    };

    // The codes are shown once: the dialog cannot be dismissed until the user confirms they saved them.
    const canDismiss = step.name !== 'codes';

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => canDismiss && onClose()}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Seguridad"
                className="w-full max-w-md rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
                style={{ background: '#2c2f33', color: '#dcddde', fontFamily: 'Open Sans, sans-serif' }}
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-black mb-4 text-white" style={{ fontFamily: 'Nunito, sans-serif' }}>
                    Seguridad
                </h2>

                {error && (
                    <div role="alert" className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
                        {error}
                    </div>
                )}

                {step.name === 'menu' && (
                    <div className="space-y-3">
                        <p className="text-sm" style={{ color: '#99aab5' }}>
                            La verificación en dos pasos pide un código de tu app autenticadora además de la contraseña.
                        </p>
                        <button type="button" disabled={busy} onClick={startSetup} className={primaryButton} style={{ background: '#7289da' }}>
                            Activar verificación en dos pasos
                        </button>
                        <button type="button" onClick={() => goTo({ name: 'regenerate' })} className={primaryButton} style={{ background: '#4e5d94' }}>
                            Generar códigos de recuperación nuevos
                        </button>
                        <button type="button" onClick={() => goTo({ name: 'disable' })} className={primaryButton} style={{ background: '#ed4245' }}>
                            Desactivar
                        </button>
                    </div>
                )}

                {step.name === 'enable' && (
                    <form onSubmit={submitCode('enable')} noValidate className="space-y-4">
                        <p className="text-sm">Escaneá el QR con tu app autenticadora (Google Authenticator, Authy, 1Password…).</p>
                        <div className="flex justify-center p-3 rounded-lg bg-white w-fit mx-auto">
                            <QRCodeSVG value={step.otpauthUri} size={168} title="Código QR para la app autenticadora" />
                        </div>
                        <div>
                            <p className="text-xs mb-1" style={{ color: '#99aab5' }}>¿No podés escanear? Cargá este secreto a mano:</p>
                            <code className="block p-2 rounded text-xs break-all select-all" style={fieldStyle}>{step.secret}</code>
                        </div>
                        <div>
                            <label htmlFor="mfa-enable-code" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#99aab5' }}>
                                Código de verificación
                            </label>
                            <input
                                id="mfa-enable-code"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                value={value}
                                onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000"
                                className="w-full px-4 py-3 rounded-lg text-sm tracking-widest text-center outline-none"
                                style={fieldStyle}
                            />
                        </div>
                        <button type="submit" disabled={busy} className={primaryButton} style={{ background: '#7289da' }}>
                            {busy ? 'Verificando…' : 'Activar'}
                        </button>
                    </form>
                )}

                {step.name === 'regenerate' && (
                    <form onSubmit={submitCode('regenerate')} noValidate className="space-y-4">
                        <p className="text-sm">Los códigos anteriores dejan de servir. Ingresá el código actual de tu app autenticadora.</p>
                        <input
                            aria-label="Código de verificación"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={value}
                            onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            className="w-full px-4 py-3 rounded-lg text-sm tracking-widest text-center outline-none"
                            style={fieldStyle}
                        />
                        <button type="submit" disabled={busy} className={primaryButton} style={{ background: '#7289da' }}>
                            {busy ? 'Generando…' : 'Generar códigos nuevos'}
                        </button>
                    </form>
                )}

                {step.name === 'disable' && (
                    <form onSubmit={submitDisable} noValidate className="space-y-4">
                        <p className="text-sm">Para desactivar la verificación en dos pasos, confirmá tu contraseña.</p>
                        <input
                            aria-label="Contraseña"
                            type="password"
                            autoComplete="current-password"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg text-sm outline-none"
                            style={fieldStyle}
                        />
                        <button type="submit" disabled={busy} className={primaryButton} style={{ background: '#ed4245' }}>
                            {busy ? 'Desactivando…' : 'Desactivar'}
                        </button>
                    </form>
                )}

                {step.name === 'codes' && (
                    <div className="space-y-4">
                        <p className="text-sm">
                            Guardá estos códigos en un lugar seguro. Cada uno sirve una sola vez y <strong>no los vas a volver a ver</strong>.
                        </p>
                        <ul className="grid grid-cols-2 gap-2 p-3 rounded-lg text-sm font-mono" style={fieldStyle} aria-label="Códigos de recuperación">
                            {step.codes.map((code) => (
                                <li key={code}>{code}</li>
                            ))}
                        </ul>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => copy(step.codes.join('\n'))} className="flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ background: '#4e5d94', color: '#fff' }}>
                                {copied ? 'Copiados' : 'Copiar'}
                            </button>
                            <button type="button" onClick={() => download(step.codes)} className="flex-1 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ background: '#4e5d94', color: '#fff' }}>
                                Descargar .txt
                            </button>
                        </div>
                        <button type="button" onClick={onClose} className={primaryButton} style={{ background: '#7289da' }}>
                            Ya los guardé
                        </button>
                    </div>
                )}

                {step.name === 'done' && (
                    <div className="space-y-4">
                        <p role="status" className="text-sm">{step.message}</p>
                        <button type="button" onClick={onClose} className={primaryButton} style={{ background: '#7289da' }}>
                            Cerrar
                        </button>
                    </div>
                )}

                {step.name !== 'codes' && step.name !== 'done' && (
                    <button
                        type="button"
                        onClick={step.name === 'menu' ? onClose : () => goTo({ name: 'menu' })}
                        className="mt-4 w-full text-sm hover:underline cursor-pointer"
                        style={{ color: '#99aab5' }}
                    >
                        {step.name === 'menu' ? 'Cerrar' : 'Volver'}
                    </button>
                )}
            </div>
        </div>
    );
};
