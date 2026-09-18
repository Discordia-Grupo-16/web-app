import { Link, Stack } from 'expo-router';
import { View, Text, TouchableOpacity } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center p-6 bg-gray-50">
        <Text className="text-2xl font-bold text-gray-900 mb-2">
          Pantalla no encontrada
        </Text>
        <Text className="text-sm text-gray-600 mb-6 text-center">
          Esta ruta no existe en la aplicación móvil.
        </Text>

        <Link href="/" asChild>
          <TouchableOpacity className="bg-indigo-600 px-6 py-3 rounded-lg">
            <Text className="text-white font-semibold">Volver al inicio</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </>
  );
}
