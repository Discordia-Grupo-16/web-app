import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { joinServer } from '@/services/invitationsService';

export default function JoinScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await joinServer(trimmed);
      Alert.alert('¡Listo!', 'Te uniste al servidor.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Código inválido o expirado.';
      Alert.alert('Error', detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#23272a]" edges={['bottom']}>
      <View className="flex-1 px-6 pt-8">
        <Text className="text-white font-black text-xl mb-1">Unirse a un servidor</Text>
        <Text className="text-[#99aab5] text-sm mb-6">
          Ingresá el código de invitación que te compartieron.
        </Text>

        <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider mb-2">
          Código de invitación
        </Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="ej: abc123def456"
          placeholderTextColor="#72767d"
          autoCapitalize="none"
          autoCorrect={false}
          className="bg-[#2c2f33] text-white rounded-lg px-4 py-3 mb-6 text-base"
        />

        <TouchableOpacity
          onPress={handleJoin}
          disabled={loading || !code.trim()}
          className="bg-[#7289da] py-3 rounded-xl items-center"
          style={{ opacity: loading || !code.trim() ? 0.6 : 1 }}
        >
          <Text className="text-white font-bold text-base">
            {loading ? 'Uniéndome…' : 'Unirme'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
