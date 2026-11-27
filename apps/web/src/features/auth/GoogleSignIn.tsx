import { useEffect, useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@discordia/core';
import { getApiErrorMessage, isMfaChallenge } from '@discordia/api';
import { authService } from '@/shared/api';
import { GOOGLE_CLIENT_ID } from '@/shared/config/env';
import { useReturnTo } from './returnTo';

interface GoogleSignInProps {
    /** Text for the form error area: a rejected token, or Google not answering (503). */
    onError: (message: string) => void;
    /** Fires when the user picks an account, before the backend answers. */
    onStart?: () => void;
    /** Blocks the button while the email form is being sent, so only one login runs at a time. */
    disabled?: boolean;
}

const GOOGLE_UNAVAILABLE = 'No pudimos conectar con Google. Ingresá con tu correo y contraseña.';

/**
 * "Continuar con Google". Google Identity Services hands back an ID token (`credential`) and the
 * backend verifies it, so the client never decides who the user is. Without a client ID in the
 * build neither the button nor its "o" divider is rendered and the email form is all there is.
 */
export const GoogleSignIn = ({ onError, onStart, disabled = false }: GoogleSignInProps) => {
    const { signIn, beginMfa } = useAuth();
    const navigate = useNavigate();
    const returnTo = useReturnTo();
    const [busy, setBusy] = useState(false);
    // The user can switch between login and register while the backend is still answering.
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    if (!GOOGLE_CLIENT_ID) return null;

    const handleCredential = async (idToken: string) => {
        onStart?.();
        setBusy(true);
        try {
            const result = await authService.loginWithGoogle(idToken);
            if (!mounted.current) return;
            if (isMfaChallenge(result)) {
                beginMfa(result.mfaToken);
                return;
            }
            await signIn(result.token, result.user, result.refreshToken);
            navigate(returnTo, { replace: true });
        } catch (err: unknown) {
            if (mounted.current) onError(getApiErrorMessage(err, GOOGLE_UNAVAILABLE));
        } finally {
            if (mounted.current) setBusy(false);
        }
    };

    const blocked = disabled || busy;

    return (
        <div className="mt-5">
            <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px" style={{ background: 'rgba(153,170,181,0.2)' }} />
                <span className="text-xs" style={{ color: '#99aab5', fontFamily: 'Open Sans, sans-serif' }}>
                    o
                </span>
                <div className="flex-1 h-px" style={{ background: 'rgba(153,170,181,0.2)' }} />
            </div>

            {/* Google draws the button in an iframe, which has no disabled state: `inert` blocks it. */}
            <div
                className={`flex justify-center ${blocked ? 'opacity-50 pointer-events-none' : ''}`}
                data-testid="google-sign-in"
                inert={blocked}
            >
                <GoogleLogin
                    text="continue_with"
                    shape="rectangular"
                    theme="filled_black"
                    onSuccess={({ credential }) => {
                        if (credential) void handleCredential(credential);
                        else onError('No pudimos validar tu cuenta de Google.');
                    }}
                    onError={() => onError(GOOGLE_UNAVAILABLE)}
                />
            </div>

            {busy && (
                <p role="status" className="mt-2 text-center text-xs" style={{ color: '#99aab5' }}>
                    Conectando con Google…
                </p>
            )}
        </div>
    );
};
