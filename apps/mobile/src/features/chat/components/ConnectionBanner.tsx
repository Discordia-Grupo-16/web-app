import { View, Text } from 'react-native';
import type { RealtimeStatus } from '@discordia/core';

const BANNERS: Record<Exclude<RealtimeStatus, 'open'>, { text: string; color: string }> = {
  idle: { text: 'Conectando…', color: '#faa61a' },
  connecting: { text: 'Conectando…', color: '#faa61a' },
  reconnecting: { text: 'Se perdió la conexión. Reconectando…', color: '#faa61a' },
  closed: { text: 'Desconectado.', color: '#ed4245' },
  disabled: { text: 'Chat en tiempo real no configurado (falta EXPO_PUBLIC_WS_URL).', color: '#ed4245' },
};

export const ConnectionBanner = ({ status }: { status: RealtimeStatus }) => {
  if (status === 'open') return null;
  const { text, color } = BANNERS[status];

  return (
    <View className="px-4 py-1" style={{ backgroundColor: color }}>
      <Text className="text-xs font-semibold text-center text-white">{text}</Text>
    </View>
  );
};
