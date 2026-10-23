import { TouchableOpacity, Image, Text } from 'react-native';
import { useRouter } from 'expo-router';
import type { User } from '@discordia/api';

export function ProfileButton({ user }: { user: User }) {
    const router = useRouter();

    return (
        <TouchableOpacity
            onPress={() => router.push('/profile')}
            style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#5865F2',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                marginRight: 15,
            }}
        >
            {user?.avatarUrl ? (
                <Image
                    source={{ uri: user.avatarUrl }}
                    style={{ width: '100%', height: '100%' }}
                />
            ) : (
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: 'bold' }}>
                    {user?.name ? user.name[0].toUpperCase() : '?'}
                </Text>
            )}
        </TouchableOpacity>
    );
}