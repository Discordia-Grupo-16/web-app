import React, { useState, useEffect } from 'react';
import { useAuth } from '@discordia/core';
import { userService } from '@/shared/api';
import axios from 'axios';

interface UserProfileEditModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UserProfileEditModal = ({ isOpen, onClose }: UserProfileEditModalProps) => {
    const { user, updateUser } = useAuth();

    const [newName, setName] = useState(user?.name || '');
    const [newBio, setBio] = useState(user?.bio || '');
    const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const nameIsEmpty = newName.trim() == ''
    const nameIsTooLong = newName.trim().length > 80
    const bioIsTooLong = newBio.trim().length > 240
    const hasError = nameIsEmpty || nameIsTooLong || bioIsTooLong

    useEffect(() => {
        return () => {
            if (avatarPreview && avatarPreview.startsWith('blob:')) {
                URL.revokeObjectURL(avatarPreview);
            }
        };
    }, [avatarPreview]);

    if (!isOpen || !user) return null;

    const avatarHasChanged = newAvatarFile !== null;
    const nameHasChanged = newName.trim() !== (user.name || '');
    const bioHasChanged = newBio.trim() !== (user.bio || '');
    const hasChanges = nameHasChanged || bioHasChanged || avatarHasChanged;

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
            if (!validTypes.includes(file.type)) {
                setErrorMessage('El formato de imagen no es válido. Usa JPG, PNG o WEBP.');
                return;
            }

            const maxSize = 5 * 1024 * 1024;
            if (file.size > maxSize) {
                setErrorMessage('La imagen es demasiado grande (máximo 5MB).');
                return;
            }

            setErrorMessage(null);
            setNewAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!hasChanges) return;

        setErrorMessage(null);
        setIsSaving(true);

        let didSaveProfile = false;

        if (nameHasChanged || bioHasChanged) {
            try {
                const response = await userService.editOwnProfile(newName.trim(), newBio.trim());
                await updateUser(response.data);
                didSaveProfile = true;
            } catch (error) {
                const apiError = axios.isAxiosError(error) ? error.response?.data : null;
                const errorMsg = apiError?.detail || apiError?.title || "Hubo un error al actualizar los datos del perfil.";

                setErrorMessage(errorMsg);
                setIsSaving(false);
                return;
            }
        }

        if (avatarHasChanged && newAvatarFile) {
            try {
                const response = await userService.editAvatar(newAvatarFile);
                await updateUser(response.data);
            } catch (error) {
                const apiError = axios.isAxiosError(error) ? error.response?.data : null;
                const errorMsg = apiError?.detail || apiError?.title || "Hubo un error al subir el avatar.";

                if (didSaveProfile) {
                    setErrorMessage(`Datos guardados, pero falló la imagen: ${errorMsg}`);
                } else {
                    setErrorMessage(`Avatar: ${errorMsg}`);
                }

                setIsSaving(false);
                return;
            }
        }

        setIsSaving(false);
        onClose();
    };

    const handleCancel = () => {
        setName(user.name || '');
        setBio(user.bio || '');
        setAvatarPreview(null);
        setNewAvatarFile(null);
        setErrorMessage(null);

        const fileInput = document.getElementById('avatar-upload') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center select-none">
            <div
                className="absolute inset-0 bg-black/70 backdrop-contrast-60 transition-opacity"
            ></div>

            <div className="relative bg-[#36393f] w-full max-w-5xl rounded-3xl shadow-2xl border border-zinc-700 overflow-hidden z-10 flex flex-col">
                <div className="h-24 sm:h-32 md:h-40 bg-[#5865f2] relative">
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="px-6 pb-6 relative">
                    <div className="absolute top-0 -translate-y-1/2 left-6 p-1.5 bg-[#36393f] rounded-full overflow-hidden group focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-[#36393f] focus-within:ring-[#5865f2]">
                        <label htmlFor="avatar-upload" className="cursor-pointer relative block rounded-full">
                            <div className="absolute inset-0 bg-black/60 hidden group-hover:flex items-center justify-center rounded-full z-10 text-white text-[10px] font-bold uppercase text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                Cambiar<br />Avatar
                            </div>

                            {avatarPreview || user.avatarUrl ? (
                                <img
                                    src={avatarPreview || user.avatarUrl || undefined}
                                    alt="Avatar"
                                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-[#36393f]"
                                />
                            ) : (
                                <div
                                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center text-5xl font-bold text-white border-4 border-[#36393f]"
                                    style={{ background: '#7289da' }}
                                >
                                    {user.name[0].toUpperCase()}
                                </div>
                            )}
                        </label>

                        <input
                            id="avatar-upload"
                            type="file"
                            accept="image/png, image/jpeg, image/webp, image/jpg"
                            className="sr-only"
                            onChange={handleAvatarChange}
                        />
                    </div>

                    <div className="mt-16 sm:mt-20 bg-[#2f3136] p-4 rounded-lg border border-zinc-700/50 flex flex-col gap-4">
                        <div className="flex justify-between items-start border-b border-zinc-700 pb-3">
                            <div>
                                <h2 className="text-white text-xl font-bold">{user.name}</h2>
                                <p className="text-zinc-400 text-xs">{user.email}</p>
                            </div>
                        </div>

                        <form onSubmit={handleSave} className="flex flex-col gap-3">

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                                    Nombre de usuario
                                </label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setName(e.target.value)}
                                    className="bg-[#202225] text-white text-sm px-3 py-2 rounded border border-zinc-700 focus:outline-none focus:border-[#5865f2]"
                                />
                                {nameIsEmpty &&
                                    (<p className="text-xs text-[#f04747] mt-0.5">
                                        El nombre de usuario no puede estar vacío.
                                    </p>)}

                                {nameIsTooLong &&
                                    (<p className="text-xs text-[#f04747] mt-0.5">
                                        El nombre de usuario no puede superar los 80 caracteres.
                                    </p>)}

                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                                    Biografía
                                </label>
                                <textarea
                                    value={newBio}
                                    onChange={(e) => setBio(e.target.value)}
                                    placeholder="¡Cuéntanos algo sobre ti!"
                                    rows={3}
                                    className="bg-[#202225] text-white text-sm px-3 py-2 rounded border border-zinc-700 focus:outline-none focus:border-[#5865f2] resize-none"
                                />
                                {bioIsTooLong &&
                                    (<p className="text-xs text-[#f04747] mt-0.5">
                                        La biografia no puede superar los 240 caracteres.
                                    </p>)}
                            </div>

                            {user.createdAt && (
                                <p className="text-zinc-400 text-xs">
                                    Miembro desde: {new Date(user.createdAt).toLocaleDateString()}
                                </p>
                            )}

                            {errorMessage && (
                                <div className="bg-red-500/10 border border-red-500/50 rounded p-2 mt-2">
                                    <p className="text-[#f04747] text-xs font-medium text-center">
                                        {errorMessage}
                                    </p>
                                </div>
                            )}

                            {hasChanges && (
                                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-700 mt-1">
                                    <button
                                        type="button"
                                        onClick={handleCancel}
                                        className="text-white text-sm hover:underline px-3 py-1.5 cursor-pointer"
                                    >
                                        Restablecer
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving || hasError}
                                        className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-1.5 rounded transition cursor-pointer disabled:opacity-50"
                                    >
                                        {isSaving ? 'Guardando...' : 'Guardar cambios'}
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};