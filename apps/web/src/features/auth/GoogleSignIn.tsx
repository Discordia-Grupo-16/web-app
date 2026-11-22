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
}

const GOOGLE_UNAVAILABLE = 'No pudimos conectar con Google. Ingresá con tu correo y contraseña.';

/**
 * "Continuar con Google". Google Identity Services hands back an ID token (`credential`) and the
 * backend verifies it, so the client never decides who the user is. Without a client ID in the
 * build the button is not rendered and the email form is all there is.
 */
export const GoogleSignIn = ({ onError, onStart }: GoogleSignInProps) => {
    const { signIn, beginMfa } = useAuth();
    const navigate = useNavigate();
    const returnTo = useReturnTo();

    if (!GOOGLE_CLIENT_ID) return null;

    const handleCredential = async (idToken: string) => {
        onStart?.();
        try {
            const result = await authService.loginWithGoogle(idToken);
            if (isMfaChallenge(result)) {
                beginMfa(result.mfaToken);
                return;
            }
            await signIn(result.token, result.user, result.refreshToken);
            navigate(returnTo, { replace: true });
        } catch (err: unknown) {
            onError(getApiErrorMessage(err, GOOGLE_UNAVAILABLE));
        }
    };

    return (
        <div className="flex justify-center" data-testid="google-sign-in">
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
    );
};
