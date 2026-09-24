import { useState, useEffect } from 'react';
import { useAuth } from '@discordia/context';
import { userService } from '../../services/userService';

export const UserProfileEditModal = ({ isOpen, onClose }) => {
    const { user, updateUser } = useAuth();

    const [newName, setName] = useState('');
    const [newBio, setBio] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null)
    const nameIsEmpty = newName.trim() == ''
    const nameIsTooLong = newName.trim().length > 80
    const bioIsTooLong = newBio.trim().length > 240
    const hasError = nameIsEmpty || nameIsTooLong || bioIsTooLong

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setBio(user.bio || '');
        }
    }, [isOpen, user]);

    if (!isOpen || !user) return null;

    const hasChanges = newName.trim() !== (user.name || '') || newBio.trim() !== (user.bio || '');

    const handleSave = async (e) => {
        e.preventDefault();
        if (!hasChanges) return;

        setErrorMessage(null);
        setIsSaving(true);
        try {
            const response = await userService.editOwnProfile(newName.trim(), newBio.trim());
            await updateUser(response.data);
            onClose();
        } catch (error) {
            const apiError = error.response?.data;

            const errorMsg = apiError?.detail
                || apiError?.title
                || "Hubo un error al actualizar tu perfil. Intenta de nuevo más tarde.";

            setErrorMessage(errorMsg)
        } finally {
            setIsSaving(false);

        }
    };

    const handleCancel = () => {
        setName(user.name || '');
        setBio(user.bio || '');
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
                    <div className="absolute top-0 -translate-y-1/2 left-6 p-1.5 bg-[#36393f] rounded-full overflow-hidden">
                        {user.avatarUrl ? (
                            <img
                                src={user.avatarUrl}
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