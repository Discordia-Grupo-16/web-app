import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Link } from 'expo-router';
import { validateEmail } from '@discordia/core';
import { DiscordiaMark } from '@discordia/ui';
import { getApiErrorMessage } from '@discordia/api';
import { authService } from '@/shared/api';
import { buildAuthHref, LOGIN_ROUTE, useReturnTo } from '../returnTo';

const SENT_MESSAGE = 'Si el correo está registrado, te llega un link para cambiar la contraseña.';
const OPEN_LINK_HINT = 'Abrí el link del correo para elegir la contraseña nueva.';
const TOO_MANY_MESSAGE = 'Hiciste muchos pedidos. Probá de nuevo en unos minutos.';

const httpStatus = (err: unknown): number | undefined =>
  (err as { response?: { status?: number } })?.response?.status;

/**
 * Asks for a recovery link. Choosing the new password happens in the web app (D10): the email
 * link opens `/reset-password`, so mobile only has the request step.
 */
export function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnTo = useReturnTo();

  const handleSubmit = async () => {
    setError(null);
    const validation = validateEmail(email);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    setLoading(true);
    try {
      await authService.requestPasswordReset(email.trim());
      setSent(true);
    } catch (err: unknown) {
      setError(
        httpStatus(err) === 429
          ? TOO_MANY_MESSAGE
          : getApiErrorMessage(err, 'No pudimos enviar el pedido. Intentá de nuevo.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#23272a]">
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          className="px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-row items-center justify-center gap-3 mb-8">
            <DiscordiaMark width={36} height={36} />
            <Text className="text-2xl font-black text-white tracking-tight">Discordia</Text>
          </View>

          <View className="bg-[#2c2f33] p-7 rounded-2xl shadow-2xl">
            <View className="mb-6 text-center items-center">
              <Text className="text-2xl font-black text-white mb-1">Recuperá tu contraseña</Text>
              <Text className="text-sm text-[#99aab5] text-center">
                Te mandamos un link al correo para elegir una nueva.
              </Text>
            </View>

            {sent ? (
              <View
                accessible
                accessibilityRole="alert"
                className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30"
              >
                <Text className="text-green-400 text-sm font-medium">{SENT_MESSAGE}</Text>
                <Text className="text-green-400 text-xs mt-2">{OPEN_LINK_HINT}</Text>
              </View>
            ) : (
              <>
                {error && (
                  <View
                    accessible
                    accessibilityRole="alert"
                    className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/40"
                  >
                    <Text className="text-red-400 text-xs font-medium">{error}</Text>
                  </View>
                )}

                <View className="mb-4">
                  <Text className="text-xs font-semibold uppercase tracking-wider text-[#99aab5] mb-2">
                    Correo electrónico
                  </Text>
                  <TextInput
                    className="w-full px-4 py-3 rounded-lg bg-[#23272a] text-white text-sm border border-transparent"
                    placeholder="tu@correo.com"
                    placeholderTextColor="#99aab5"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                  />
                </View>

                <TouchableOpacity
                  className="w-full bg-[#7289da] active:bg-[#677bc4] py-3.5 rounded-lg items-center justify-center mt-2"
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  <Text className="text-white font-bold text-base">
                    {loading ? 'Enviando…' : 'Enviar link'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <View className="mt-4 flex-row items-center">
              <Link href={buildAuthHref(LOGIN_ROUTE, returnTo)} asChild>
                <TouchableOpacity>
                  <Text className="text-xs font-semibold text-[#7289da]">
                    Volver a iniciar sesión
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
