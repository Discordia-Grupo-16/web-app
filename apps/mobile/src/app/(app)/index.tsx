import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/context/auth-context';
import { DiscordiaMark } from '@discordia/ui';

export default function HomeScreen() {
  const { user, signOut } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-[#23272a]">
      <StatusBar style="light" />
      <View className="flex-1 p-6 justify-between">
        <View className="bg-[#2c2f33] p-6 rounded-2xl shadow-2xl mt-4">
          <View className="flex-row items-center gap-3 mb-4">
            <DiscordiaMark width={32} height={32} />
            <Text className="text-xl font-bold text-white">
              Discordia
            </Text>
          </View>

          <Text className="text-sm text-[#99aab5] mb-6">
            Estructura base de Mobile Android funcionando en sincronía con Web.
          </Text>

          <View className="bg-[#23272a] p-4 rounded-lg">
            <Text className="text-xs font-semibold text-[#99aab5] uppercase tracking-wider mb-2">
              Sesión Activa
            </Text>
            <Text className="text-sm text-gray-300 mb-1">
              Usuario: <Text className="font-semibold text-white">{user?.name || 'Desconocido'}</Text>
            </Text>
            <Text className="text-sm text-gray-300">
              Email: <Text className="font-semibold text-white">{user?.email || 'N/A'}</Text>
            </Text>
          </View>
        </View>

        <TouchableOpacity
          className="w-full bg-[#ed4245] active:bg-[#c93b3e] py-3.5 rounded-lg items-center justify-center mb-4"
          onPress={signOut}
        >
          <Text className="text-white font-bold text-base">
            Cerrar Sesión
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
