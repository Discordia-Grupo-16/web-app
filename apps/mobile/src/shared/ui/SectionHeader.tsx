import { Text, TouchableOpacity, View } from 'react-native';

export function SectionHeader({ title, canManage, onAdd }: {
  title: string; canManage: boolean; onAdd: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between px-1 mt-2">
      <Text className="text-[#8e9297] text-xs font-semibold uppercase tracking-widest">{title}</Text>
      {canManage && (
        <TouchableOpacity onPress={onAdd}>
          <Text className="text-[#8e9297] text-xl leading-5">+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
