import { View, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@discordia/context';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProfileScreen() {
    const { user, signOut } = useAuth();
    const router = useRouter();

    if (!user) return null;

    return (
        <ScrollView className="flex-1 bg-[#23272a]">
            <Stack.Screen
                options={{
                    title: 'Perfil',
                    headerStyle: { backgroundColor: '#18191c' },
                }}
            />

            <View className="m-4 rounded-2xl overflow-hidden bg-[#18191c]" style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                <LinearGradient
                    colors={['#7289da', '#5b6eae', '#4e5d94']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="h-28 w-full"
                />


                <View className="self-center mt-10 w-[110px] h-[110px] rounded-full border-[6px] border-[#18191c] bg-[#7289da] items-center justify-center overflow-hidden z-20">
                    {user.avatarUrl ? (
                        <Image
                            source={{ uri: user.avatarUrl }}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <Text className="text-white text-3xl font-bold">
                            {user.name ? user.name[0].toUpperCase() : '?'}
                        </Text>
                    )}
                </View>

                <View className="px-4 pt-14 pb-4">

                    <Text className="text-white text-xl font-bold mb-4">
                        {user.name}
                    </Text>

                    {user.bio && (
                        <View className="mb-4">
                            <View className="h-[1px] bg-white/10 mb-3" />
                            <Text className="text-[#72767d] text-xs font-bold uppercase tracking-wider mb-1">
                                Sobre mí
                            </Text>
                            <Text className="text-[#dcddde] text-sm leading-5">
                                {user.bio}
                            </Text>
                        </View>
                    )}

                    {user.createdAt && (
                        <View className="mb-4">
                            <View className="h-[1px] bg-white/10 mb-3" />
                            <Text className="text-[#72767d] text-xs font-bold uppercase tracking-wider mb-1">
                                Miembro desde
                            </Text>
                            <Text className="text-[#dcddde] text-sm">
                                {new Date(user.createdAt).toLocaleDateString('es-AR', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </Text>
                        </View>
                    )}

                    <View className="mt-2">
                        <TouchableOpacity
                            onPress={() => router.push('/edit-profile')}
                            className="w-full py-2.5 rounded-lg border border-[#7289da]/40 bg-[#7289da]/15 items-center"
                        >
                            <Text className="text-[#7289da] font-bold text-sm">
                                Editar perfil
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => {
                                if (signOut) signOut();
                            }}
                            className="w-full py-2.5 rounded-lg bg-[#ed4245] items-center mt-3"
                        >
                            <Text className="text-white font-bold text-sm">
                                Cerrar sesión
                            </Text>
                        </TouchableOpacity>
                    </View>

                </View>
            </View>
        </ScrollView>
    );
}