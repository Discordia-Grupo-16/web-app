import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@discordia/core';
import { getApiErrorMessage, isMfaChallenge } from '@discordia/api';
import { authService } from '@/shared/api';
import { GOOGLE_ANDROID_CLIENT_ID } from '@/shared/config/env';
import { HOME_ROUTE, useReturnTo } from '../returnTo';

// Closes the browser tab that Google redirects back from, so the pending prompt can resolve.
WebBrowser.maybeCompleteAuthSession();

interface GoogleSignInProps {
  /** Text for the form error area: a rejected token, or Google not answering (503). */
  onError: (message: string) => void;
  /** Fires when the user picks an account, before the backend answers. */
  onStart?: () => void;
}

const GOOGLE_UNAVAILABLE = 'No pudimos conectar con Google. Ingresá con tu correo y contraseña.';
const GOOGLE_INVALID = 'No pudimos validar tu cuenta de Google.';

/**
 * "Continuar con Google". Google hands back an ID token and the backend verifies it, so the client
 * never decides who the user is. Without an Android client ID in the build nothing is rendered and
 * the email form is all there is. The hook lives in the inner component because
 * `useIdTokenAuthRequest` throws when the client ID of the platform is missing.
 */
export function GoogleSignIn(props: GoogleSignInProps) {
  if (!GOOGLE_ANDROID_CLIENT_ID) return null;
  return <GoogleSignInButton {...props} />;
}

function GoogleSignInButton({ onError, onStart }: GoogleSignInProps) {
  const { signIn, beginMfa } = useAuth();
  const router = useRouter();
  const returnTo = useReturnTo();
  const [busy, setBusy] = useState(false);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    selectAccount: true,
  });

  useEffect(() => {
    if (!response) return;

    if (response.type === 'error') {
      onError(GOOGLE_UNAVAILABLE);
      return;
    }
    // "dismiss" and "cancel": the user closed the Google sheet, nothing to report.
    if (response.type !== 'success') return;

    const idToken = response.params?.id_token;
    if (!idToken) {
      onError(GOOGLE_INVALID);
      return;
    }

    let active = true;
    (async () => {
      setBusy(true);
      try {
        const result = await authService.loginWithGoogle(idToken);
        if (!active) return;
        if (isMfaChallenge(result)) {
          beginMfa(result.mfaToken);
          return;
        }
        await signIn(result.token, result.user, result.refreshToken);
        router.replace((returnTo ?? HOME_ROUTE) as Href);
      } catch (err: unknown) {
        if (active) onError(getApiErrorMessage(err, GOOGLE_UNAVAILABLE));
      } finally {
        if (active) setBusy(false);
      }
    })();

    return () => {
      active = false;
    };
    // The response is the only trigger: the rest are stable callbacks of this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const handlePress = () => {
    onStart?.();
    void promptAsync();
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      className="w-full border border-[#99aab5]/40 active:bg-[#23272a] py-3.5 rounded-lg items-center justify-center"
      onPress={handlePress}
      disabled={!request || busy}
    >
      <Text className="text-white font-bold text-base">
        {busy ? 'Conectando con Google…' : 'Continuar con Google'}
      </Text>
    </TouchableOpacity>
  );
}
