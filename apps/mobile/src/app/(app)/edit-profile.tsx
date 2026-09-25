import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@discordia/context';
import { userService } from '../../services/userService';
import axios from 'axios';

export default function EditProfileScreen() {
    const { user, updateUser } = useAuth();
    const router = useRouter();

    const [newName, setName] = useState('');
    const [newBio, setBio] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const nameIsEmpty = newName.trim() === '';
    const nameIsTooLong = newName.trim().length > 80;
    const bioIsTooLong = newBio.trim().length > 240;
    const hasError = nameIsEmpty || nameIsTooLong || bioIsTooLong;

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setBio(user.bio || '');
        }
    }, [user]);

    if (!user) return null;

    const hasChanges = newName.trim() !== (user.name || '') || newBio.trim() !== (user.bio || '');

    const handleSave = async () => {
        if (!hasChanges || hasError || isSaving) return;

        setErrorMessage(null);
        setIsSaving(true);
        try {
            const response = await userService.editOwnProfile(newName.trim(), newBio.trim());
            await updateUser(response.data);
            router.back();
        } catch (error) {
            const apiError = axios.isAxiosError(error) ? error.response?.data : null;
            const errorMsg = apiError?.detail
                || apiError?.title
                || "Hubo un error al actualizar tu perfil. Intenta de nuevo más tarde.";

            setErrorMessage(errorMsg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setName(user.name || '');
        setBio(user.bio || '');
        setErrorMessage(null);
    };

    return (
        <ScrollView className="flex-1 bg-[#23272a] p-4">
            <Stack.Screen
                options={{
                    title: 'Editar Perfil',
                    headerStyle: { backgroundColor: '#18191c' },
                    headerTintColor: '#ffffff',
                }}
            />



            <View className="bg-[#2f3136] p-4 rounded-lg border border-zinc-700/50 flex flex-col gap-4 mt-2 mb-8">
                <View className="border-b border-zinc-700 pb-4 items-center justify-center">
                    <View className="w-24 h-24 rounded-full bg-[#7289da] items-center justify-center overflow-hidden mb-3">
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
                    <Text className="text-white text-xl font-bold text-center">{user.name}</Text>
                    {user.email && (
                        <Text className="text-zinc-400 text-xs mt-1 text-center">{user.email}</Text>
                    )}
                </View>

                <View className="flex flex-col gap-4">

                    <View className="flex flex-col gap-1">
                        <Text className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                            Nombre de usuario
                        </Text>
                        <TextInput
                            value={newName}
                            onChangeText={setName}
                            className={`bg-[#202225] text-white text-sm px-3 py-2.5 rounded border ${nameIsEmpty || nameIsTooLong ? 'border-[#f04747]' : 'border-zinc-700 focus:border-[#5865f2]'
                                }`}
                            placeholder="Tu nombre de usuario"
                            placeholderTextColor="#72767d"
                        />
                        {nameIsEmpty && (
                            <Text className="text-xs text-[#f04747] mt-0.5">
                                El nombre de usuario no puede estar vacío.
                            </Text>
                        )}
                        {nameIsTooLong && (
                            <Text className="text-xs text-[#f04747] mt-0.5">
                                El nombre de usuario no puede superar los 80 caracteres.
                            </Text>
                        )}
                    </View>

                    <View className="flex flex-col gap-1">
                        <Text className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                            Biografía
                        </Text>
                        <TextInput
                            value={newBio}
                            onChangeText={setBio}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            placeholder="¡Cuéntanos algo sobre ti!"
                            placeholderTextColor="#72767d"
                            className={`bg-[#202225] text-white text-sm px-3 py-2.5 rounded border h-24 ${bioIsTooLong ? 'border-[#f04747]' : 'border-zinc-700 focus:border-[#5865f2]'
                                }`}
                        />
                        {bioIsTooLong && (
                            <Text className="text-xs text-[#f04747] mt-0.5">
                                La biografía no puede superar los 240 caracteres.
                            </Text>
                        )}
                    </View>

                    {user.createdAt && (
                        <Text className="text-zinc-400 text-xs mt-2">
                            Miembro desde: {new Date(user.createdAt).toLocaleDateString()}
                        </Text>
                    )}

                    {errorMessage && (
                        <View className="bg-red-500/10 border border-red-500/50 rounded p-2 mt-2">
                            <Text className="text-[#f04747] text-xs font-medium text-center">
                                {errorMessage}
                            </Text>
                        </View>
                    )}

                    {hasChanges && (
                        <View className="flex-row justify-end items-center gap-3 pt-4 border-t border-zinc-700 mt-2">
                            <TouchableOpacity
                                onPress={handleCancel}
                                disabled={isSaving}
                            >
                                <Text className="text-white text-sm font-medium mr-2">
                                    Restablecer
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleSave}
                                disabled={isSaving || hasError}
                                className={`px-4 py-2 rounded flex-row items-center justify-center min-w-[140px] ${isSaving || hasError ? 'bg-green-600/50' : 'bg-green-600'
                                    }`}
                            >
                                {isSaving ? (
                                    <>
                                        <ActivityIndicator size="small" color="#ffffff" className="mr-2" />
                                        <Text className="text-white text-sm font-medium">Guardando...</Text>
                                    </>
                                ) : (
                                    <Text className="text-white text-sm font-medium">Guardar cambios</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </ScrollView>
    );
}