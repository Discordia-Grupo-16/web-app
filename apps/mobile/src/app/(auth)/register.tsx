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
import { Link, useRouter } from 'expo-router';
import { useAuth, validateRegisterInput } from '@discordia/core';
import { DiscordiaMark, EyeIcon, EyeOffIcon } from '@discordia/ui';
import { getApiErrorMessage } from '@discordia/api';
import { authService } from '@/services/auth-service';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    const validation = validateRegisterInput({ name, email, password });
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { token, user } = await authService.register({
        email: email.trim(),
        name: name.trim(),
        password,
      });
      await signIn(token, user);
      router.replace('/(app)');
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(err, 'Ocurrió un error al crear la cuenta. Intente nuevamente.')
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
          contentInsetAdjustmentBehavior="automatic"
        >
          {/* Logo y Marca */}
          <View className="flex-row items-center justify-center gap-3 mb-8">
            <DiscordiaMark width={36} height={36} />
            <Text className="text-2xl font-black text-white tracking-tight">
              Discordia
            </Text>
          </View>

          {/* Tarjeta Dark Discordia */}
          <View className="bg-[#2c2f33] p-7 rounded-2xl shadow-2xl">
            <View className="mb-6 text-center items-center">
              <Text className="text-2xl font-black text-white mb-1">
                Crear una cuenta
              </Text>
              <Text className="text-sm text-[#99aab5]">
                Únete a la comunidad de Discordia.
              </Text>
            </View>

            {error && (
              <View className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/40">
                <Text className="text-red-400 text-xs font-medium">{error}</Text>
              </View>
            )}

            {/* Campo Nombre */}
            <View className="mb-4">
              <Text className="text-xs font-semibold uppercase tracking-wider text-[#99aab5] mb-2">
                Nombre de usuario
              </Text>
              <TextInput
                className="w-full px-4 py-3 rounded-lg bg-[#23272a] text-white text-sm border border-transparent"
                placeholder="Tu apodo o nombre"
                placeholderTextColor="#99aab5"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="name"
              />
            </View>

            {/* Campo Email */}
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

            {/* Campo Contraseña con Toggle */}
            <View className="mb-2">
              <Text className="text-xs font-semibold uppercase tracking-wider text-[#99aab5] mb-2">
                Contraseña
              </Text>

              <View className="relative justify-center">
                <TextInput
                  className="w-full px-4 py-3 pr-12 rounded-lg bg-[#23272a] text-white text-sm border border-transparent"
                  placeholder="••••••••"
                  placeholderTextColor="#99aab5"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 p-1"
                >
                  {showPassword ? (
                    <EyeOffIcon size={18} color="#99aab5" />
                  ) : (
                    <EyeIcon size={18} color="#99aab5" />
                  )}
                </TouchableOpacity>
              </View>
              <Text className="text-[11px] text-[#99aab5] mt-1.5">
                Mínimo 8 caracteres, con mayúscula, minúscula y número.
              </Text>
            </View>

            {/* Botón Principal Blurple */}
            <TouchableOpacity
              className="w-full bg-[#7289da] active:bg-[#677bc4] py-3.5 rounded-lg items-center justify-center mt-6"
              onPress={handleRegister}
              disabled={loading}
            >
              <Text className="text-white font-bold text-base">
                {loading ? 'Creando cuenta…' : 'Continuar'}
              </Text>
            </TouchableOpacity>

            {/* Enlace Login */}
            <View className="mt-4 flex-row items-center">
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text className="text-xs font-semibold text-[#7289da]">
                    ¿Ya tienes una cuenta?
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
