import React, { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
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
  /** Fires when the button is pressed, before Google opens. */
  onStart?: () => void;
  /** Blocks the button while the email form is being sent, so only one login runs at a time. */
  disabled?: boolean;
}

const GOOGLE_UNAVAILABLE = 'No pudimos conectar con Google. Ingresá con tu correo y contraseña.';
const GOOGLE_INVALID = 'No pudimos validar tu cuenta de Google.';

/**
 * "Continuar con Google". Google hands back an ID token and the backend verifies it, so the client
 * never decides who the user is. Without an Android client ID in the build neither the button nor its
 * "o" divider is rendered and the email form is all there is. The hook lives in the inner component because
 * `useIdTokenAuthRequest` throws when the client ID of the platform is missing.
 */
export function GoogleSignIn(props: GoogleSignInProps) {
  if (!GOOGLE_ANDROID_CLIENT_ID) return null;
  return <GoogleSignInButton {...props} />;
}

function GoogleSignInButton({ onError, onStart, disabled = false }: GoogleSignInProps) {
  const { signIn, beginMfa } = useAuth();
  const router = useRouter();
  const returnTo = useReturnTo();
  const [busy, setBusy] = useState(false);
  // True while the browser tab with Google is open: a second press would open a second prompt.
  const [prompting, setPrompting] = useState(false);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    selectAccount: true,
  });

  // The effect below must run once per Google answer, not every time a callback changes identity.
  const latest = useRef({ onError, signIn, beginMfa, router, returnTo });
  useEffect(() => {
    latest.current = { onError, signIn, beginMfa, router, returnTo };
  });

  useEffect(() => {
    if (!response) return;
    const { onError, signIn, beginMfa, router, returnTo } = latest.current;

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
  }, [response]);

  const openPrompt = async () => {
    setPrompting(true);
    try {
      await promptAsync();
    } catch {
      // No browser able to open the Google page, for instance.
      onError(GOOGLE_UNAVAILABLE);
    } finally {
      setPrompting(false);
    }
  };

  const handlePress = () => {
    onStart?.();
    void openPrompt();
  };

  return (
    <View className="mt-4">
      <View className="flex-row items-center gap-3 mb-4">
        <View className="flex-1 h-px bg-[#99aab5]/20" />
        <Text className="text-xs text-[#99aab5]">o</Text>
        <View className="flex-1 h-px bg-[#99aab5]/20" />
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        className="w-full border border-[#99aab5]/40 active:bg-[#23272a] py-3.5 rounded-lg items-center justify-center"
        onPress={handlePress}
        disabled={!request || busy || prompting || disabled}
      >
        <Text className="text-white font-bold text-base">
          {busy ? 'Conectando con Google…' : 'Continuar con Google'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
