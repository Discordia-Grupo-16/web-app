import React, { useState } from 'react';
import {
  Linking,
  Modal,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
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

const FIELD = 'w-full px-4 py-3 rounded-lg bg-[#23272a] text-white text-sm';
const PRIMARY = 'w-full py-3 rounded-lg items-center bg-[#7289da]';
const SECONDARY = 'w-full py-3 rounded-lg items-center bg-[#4e5d94]';
const DANGER = 'w-full py-3 rounded-lg items-center bg-[#ed4245]';

interface SecurityModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SecurityModal({ visible, onClose }: SecurityModalProps) {
  const [step, setStep] = useState<Step>({ name: 'menu' });
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'secret' | 'codes' | null>(null);

  const goTo = (next: Step) => {
    setStep(next);
    setValue('');
    setError(null);
    setCopied(null);
  };

  const close = () => {
    goTo({ name: 'menu' });
    onClose();
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
      { 409: 'La verificación en dos pasos ya está activa. Podés generar códigos nuevos o desactivarla.' }
    );

  const submitCode = (kind: 'enable' | 'regenerate') => {
    if (!/^\d{6}$/.test(value)) {
      setError('El código tiene 6 dígitos.');
      return;
    }
    return run(
      async () => {
        const { recoveryCodes } =
          kind === 'enable'
            ? await mfaService.enable(value)
            : await mfaService.regenerateRecoveryCodes(value);
        goTo({ name: 'codes', codes: recoveryCodes });
      },
      {
        400: 'El código no es válido',
        409:
          kind === 'enable'
            ? 'La verificación en dos pasos ya está activa.'
            : 'La verificación en dos pasos no está activa.',
      }
    );
  };

  const submitDisable = () => {
    if (!value) {
      setError('Ingresá tu contraseña.');
      return;
    }
    return run(
      async () => {
        await mfaService.disable(value);
        goTo({ name: 'done', message: 'Desactivaste la verificación en dos pasos.' });
      },
      {
        401: 'La contraseña es incorrecta',
        409: 'La verificación en dos pasos no está activa, o tu cuenta no tiene contraseña.',
      }
    );
  };

  const copy = async (text: string, what: 'secret' | 'codes') => {
    try {
      await Clipboard.setStringAsync(text);
      setCopied(what);
    } catch {
      setError('No pudimos copiar. Probá de nuevo.');
    }
  };

  // A phone cannot scan its own screen, so the same URI opens straight in the authenticator app.
  const openInAuthenticator = async (uri: string) => {
    try {
      await Linking.openURL(uri);
    } catch {
      setError('No encontramos una app autenticadora. Escaneá el QR desde otro dispositivo o cargá el secreto a mano.');
    }
  };

  const shareCodes = async (codes: string[]) => {
    try {
      await Share.share({ message: `Códigos de recuperación de Discordia\n\n${codes.join('\n')}` });
    } catch {
      setError('No pudimos compartir los códigos.');
    }
  };

  // The codes are shown once: the dialog cannot be dismissed until the user confirms they saved them.
  const canDismiss = step.name !== 'codes';

  const codeInput = (label: string) => (
    <TextInput
      accessibilityLabel={label}
      className={`${FIELD} text-center tracking-widest`}
      placeholder="000000"
      placeholderTextColor="#99aab5"
      keyboardType="number-pad"
      autoComplete="one-time-code"
      textContentType="oneTimeCode"
      value={value}
      onChangeText={(t) => setValue(t.replace(/\D/g, '').slice(0, 6))}
    />
  );

  const button = (label: string, onPress: () => void, className: string, disabled = false) => (
    <TouchableOpacity accessibilityRole="button" className={className} onPress={onPress} disabled={disabled}>
      <Text className="text-white font-bold text-sm">{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => canDismiss && close()}
    >
      <View className="flex-1 justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <ScrollView
          className="rounded-2xl bg-[#2c2f33] max-h-[90%]"
          contentContainerStyle={{ padding: 24, gap: 14 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-xl font-black text-white">Seguridad</Text>

          {error && (
            <View accessible accessibilityRole="alert" className="p-3 rounded-lg bg-red-500/20 border border-red-500/40">
              <Text className="text-red-400 text-xs font-medium">{error}</Text>
            </View>
          )}

          {step.name === 'menu' && (
            <>
              <Text className="text-sm text-[#99aab5]">
                La verificación en dos pasos pide un código de tu app autenticadora además de la contraseña.
              </Text>
              {button('Activar verificación en dos pasos', startSetup, PRIMARY, busy)}
              {button('Generar códigos de recuperación nuevos', () => goTo({ name: 'regenerate' }), SECONDARY)}
              {button('Desactivar', () => goTo({ name: 'disable' }), DANGER)}
            </>
          )}

          {step.name === 'enable' && (
            <>
              <Text className="text-sm text-[#dcddde]">
                Escaneá el QR con tu app autenticadora desde otro dispositivo, o abrilo en la app de este teléfono.
              </Text>
              <View className="self-center p-3 rounded-lg bg-white" accessibilityLabel="Código QR para la app autenticadora">
                <QRCode value={step.otpauthUri} size={168} />
              </View>
              {button('Abrir en la app autenticadora', () => openInAuthenticator(step.otpauthUri), SECONDARY)}
              <View>
                <Text className="text-xs text-[#99aab5] mb-1">¿No podés escanear? Cargá este secreto a mano:</Text>
                <Text selectable className="p-2 rounded bg-[#23272a] text-white text-xs">
                  {step.secret}
                </Text>
              </View>
              {button(copied === 'secret' ? 'Copiado' : 'Copiar secreto', () => copy(step.secret, 'secret'), SECONDARY)}
              <Text className="text-xs font-semibold uppercase tracking-wider text-[#99aab5]">Código de verificación</Text>
              {codeInput('Código de verificación')}
              {button(busy ? 'Verificando…' : 'Activar', () => submitCode('enable'), PRIMARY, busy)}
            </>
          )}

          {step.name === 'regenerate' && (
            <>
              <Text className="text-sm text-[#dcddde]">
                Los códigos anteriores dejan de servir. Ingresá el código actual de tu app autenticadora.
              </Text>
              {codeInput('Código de verificación')}
              {button(busy ? 'Generando…' : 'Generar códigos nuevos', () => submitCode('regenerate'), PRIMARY, busy)}
            </>
          )}

          {step.name === 'disable' && (
            <>
              <Text className="text-sm text-[#dcddde]">
                Para desactivar la verificación en dos pasos, confirmá tu contraseña.
              </Text>
              <TextInput
                accessibilityLabel="Contraseña"
                className={FIELD}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                value={value}
                onChangeText={setValue}
              />
              {button(busy ? 'Desactivando…' : 'Desactivar', submitDisable, DANGER, busy)}
            </>
          )}

          {step.name === 'codes' && (
            <>
              <Text className="text-sm text-[#dcddde]">
                Guardá estos códigos en un lugar seguro. Cada uno sirve una sola vez y no los vas a volver a ver.
              </Text>
              <View accessibilityLabel="Códigos de recuperación" className="flex-row flex-wrap p-3 rounded-lg bg-[#23272a]">
                {step.codes.map((code) => (
                  <Text key={code} selectable className="w-1/2 py-1 text-white text-sm font-mono">
                    {code}
                  </Text>
                ))}
              </View>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  accessibilityRole="button"
                  className="flex-1 py-2.5 rounded-lg items-center bg-[#4e5d94]"
                  onPress={() => copy(step.codes.join('\n'), 'codes')}
                >
                  <Text className="text-white font-semibold text-xs">{copied === 'codes' ? 'Copiados' : 'Copiar'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  className="flex-1 py-2.5 rounded-lg items-center bg-[#4e5d94]"
                  onPress={() => shareCodes(step.codes)}
                >
                  <Text className="text-white font-semibold text-xs">Compartir</Text>
                </TouchableOpacity>
              </View>
              {button('Ya los guardé', close, PRIMARY)}
            </>
          )}

          {step.name === 'done' && (
            <>
              <Text accessibilityRole="text" accessibilityLiveRegion="polite" className="text-sm text-[#dcddde]">
                {step.message}
              </Text>
              {button('Cerrar', close, PRIMARY)}
            </>
          )}

          {step.name !== 'codes' && step.name !== 'done' && (
            <TouchableOpacity
              accessibilityRole="button"
              className="items-center py-1"
              onPress={step.name === 'menu' ? close : () => goTo({ name: 'menu' })}
            >
              <Text className="text-sm text-[#99aab5]">{step.name === 'menu' ? 'Cerrar' : 'Volver'}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
