import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { DiscordiaMark, EyeIcon, EyeOffIcon } from '@discordia/ui';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signIn('demo-jwt-token', {
        email: email || 'usuario@discordia.com',
        name: 'Usuario Demo',
      });
      router.replace('/(app)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#23272a]">
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          className="px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo y Nombre de Marca */}
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
                ¡Bienvenido de vuelta!
              </Text>
              <Text className="text-sm text-[#99aab5]">
                Nos alegra verte de nuevo.
              </Text>
            </View>

            {/* Campo Email */}
            <View className="mb-4">
              <Text className="text-xs font-semibold uppercase tracking-wider text-[#99aab5] mb-2">
                Correo electrónico o teléfono
              </Text>
              <TextInput
                className="w-full px-4 py-3 rounded-lg bg-[#23272a] text-white text-sm border border-transparent"
                placeholder="tu@correo.com"
                placeholderTextColor="#99aab5"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* Campo Contraseña con Toggle */}
            <View className="mb-2">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-xs font-semibold uppercase tracking-wider text-[#99aab5]">
                  Contraseña
                </Text>
                <TouchableOpacity>
                  <Text className="text-xs font-medium text-[#7289da]">
                    ¿Olvidaste tu contraseña?
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="relative justify-center">
                <TextInput
                  className="w-full px-4 py-3 pr-12 rounded-lg bg-[#23272a] text-white text-sm border border-transparent"
                  placeholder="••••••••"
                  placeholderTextColor="#99aab5"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
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
            </View>

            {/* Botón Principal Blurple */}
            <TouchableOpacity
              className="w-full bg-[#7289da] active:bg-[#677bc4] py-3.5 rounded-lg items-center justify-center mt-6"
              onPress={handleLogin}
              disabled={loading}
            >
              <Text className="text-white font-bold text-base">
                {loading ? 'Iniciando sesión…' : 'Iniciar Sesión'}
              </Text>
            </TouchableOpacity>

            {/* Enlace Registro */}
            <View className="mt-4 flex-row items-center">
              <Text className="text-xs text-[#99aab5]">¿Necesitas una cuenta? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text className="text-xs font-semibold text-[#7289da]">
                    Regístrate
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
