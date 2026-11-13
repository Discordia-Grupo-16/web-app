import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
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

export function MfaStep({ onVerified }: MfaStepProps) {
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

  const handleSubmit = async () => {
    setError(null);

    const valid = useRecovery ? /^[a-z0-9]{4}-[a-z0-9]{4}$/.test(value) : /^\d{6}$/.test(value);
    if (!valid) {
      setError(
        useRecovery
          ? 'El código de recuperación tiene el formato xxxx-xxxx.'
          : 'El código tiene 6 dígitos.'
      );
      return;
    }

    setLoading(true);
    try {
      const { recoveryCodesRemaining } = await completeMfa(
        useRecovery ? { recoveryCode: value } : { code: value }
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
    <View className="bg-[#2c2f33] p-7 rounded-2xl shadow-2xl">
      <View className="mb-6 items-center">
        <Text className="text-2xl font-black text-white mb-1">Verificación en dos pasos</Text>
        <Text className="text-sm text-[#99aab5] text-center">
          {useRecovery
            ? 'Ingresá uno de tus códigos de recuperación.'
            : 'Ingresá el código de tu app autenticadora.'}
        </Text>
      </View>

      {error && (
        <View
          accessible
          accessibilityRole="alert"
          className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/40"
        >
          <Text className="text-red-400 text-xs font-medium">{error}</Text>
        </View>
      )}

      <View className="mb-2">
        <Text className="text-xs font-semibold uppercase tracking-wider text-[#99aab5] mb-2">
          {useRecovery ? 'Código de recuperación' : 'Código de verificación'}
        </Text>
        <TextInput
          accessibilityLabel={useRecovery ? 'Código de recuperación' : 'Código de verificación'}
          className="w-full px-4 py-3 rounded-lg bg-[#23272a] text-white text-sm text-center tracking-widest border border-transparent"
          placeholder={useRecovery ? 'xxxx-xxxx' : '000000'}
          placeholderTextColor="#99aab5"
          value={value}
          onChangeText={handleChange}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={useRecovery ? 'default' : 'number-pad'}
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
        />
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        className="w-full bg-[#7289da] active:bg-[#677bc4] py-3.5 rounded-lg items-center justify-center mt-6"
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text className="text-white font-bold text-base">{loading ? 'Verificando…' : 'Verificar'}</Text>
      </TouchableOpacity>

      <View className="mt-5 items-center gap-3">
        <TouchableOpacity accessibilityRole="button" onPress={switchMode}>
          <Text className="text-sm font-semibold text-[#7289da]">
            {useRecovery ? 'Usar el código de la app' : 'Usar un código de recuperación'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={cancelMfa}>
          <Text className="text-sm text-[#99aab5]">Volver al inicio de sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface RecoveryNoticeProps {
  remaining: number;
  onContinue: () => void;
}

/** CA4: shown after a recovery code was spent, before entering the app. */
export function RecoveryNotice({ remaining, onContinue }: RecoveryNoticeProps) {
  return (
    <View className="bg-[#2c2f33] p-7 rounded-2xl shadow-2xl items-center">
      <Text className="text-2xl font-black text-white mb-3 text-center">
        Entraste con un código de recuperación
      </Text>
      <Text accessibilityRole="text" accessibilityLiveRegion="polite" className="text-sm text-[#99aab5] mb-6 text-center">
        {remaining === 1
          ? 'Te queda 1 código. Te recomendamos generar nuevos desde Seguridad, en tu perfil.'
          : `Te quedan ${remaining} códigos. Te recomendamos generar nuevos desde Seguridad, en tu perfil.`}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        className="w-full bg-[#7289da] py-3.5 rounded-lg items-center justify-center"
        onPress={onContinue}
      >
        <Text className="text-white font-bold text-base">Continuar</Text>
      </TouchableOpacity>
    </View>
  );
}
