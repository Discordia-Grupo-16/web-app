import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, FolderPlus, Pencil, Trash2 } from 'lucide-react';
import type { Category, Channel } from '@discordia/api';
import { categoriesService, channelsService } from '@/shared/api';
import { ConfirmModal } from '@/shared/ui/ConfirmModal';
import { ChannelGroup } from './ChannelGroup';
import { CreateChannelModal } from './CreateChannelModal';
import { EditChannelModal } from './EditChannelModal';

interface ChannelListProps {
    serverId: string;
    channels: Channel[];
    categories?: Category[];
    activeChannelId?: string;
    canManage: boolean;
    /** The list does not own the channels: the server does. */
    onChannelsChange: (update: (channels: Channel[]) => Channel[]) => void;
    onCategoriesChange?: (update: (cats: Category[]) => Category[]) => void;
    /** Drawn under the row of each channel; the list does not know what goes there. */
    renderBelowChannel?: (channel: Channel) => ReactNode;
}

interface CategoryFormState {
    mode: 'create' | 'rename';
    category?: Category;
    value: string;
    loading: boolean;
    error: string | null;
}

export const ChannelList = ({
    serverId,
    channels,
    categories = [],
    activeChannelId,
    canManage,
    onChannelsChange,
    onCategoriesChange,
    renderBelowChannel,
}: ChannelListProps) => {
    const navigate = useNavigate();
    const [createType, setCreateType] = useState<'text' | 'voice' | null>(null);
    const [pendingEdit, setPendingEdit] = useState<Channel | null>(null);
    const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
    const [categoryForm, setCategoryForm] = useState<CategoryFormState | null>(null);
    const [pendingDeleteCat, setPendingDeleteCat] = useState<{ id: string; name: string } | null>(null);

    const handleChannelCreated = (channel: Channel) => {
        onChannelsChange(prev => [...prev, channel]);
        setCreateType(null);
        navigate(`/servers/${serverId}/channels/${channel.id}`);
    };

    const handleChannelUpdated = (updated: Channel) => {
        onChannelsChange(prev => prev.map(c => c.id === updated.id ? updated : c));
        setPendingEdit(null);
    };

    const confirmChannelDelete = async () => {
        if (!pendingDelete) return;
        const { id } = pendingDelete;
        setPendingDelete(null);
        try {
            await channelsService.deleteChannel(serverId, id);
            onChannelsChange(prev => prev.filter(c => c.id !== id));
            if (id === activeChannelId) navigate(`/servers/${serverId}`);
        } catch (err) {
            const error = err as { response?: { data?: { detail?: string } } };
            window.alert(error.response?.data?.detail || 'Error al eliminar el canal');
        }
    };

    const submitCategoryForm = async () => {
        if (!categoryForm) return;
        setCategoryForm(prev => prev && { ...prev, loading: true, error: null });
        try {
            if (categoryForm.mode === 'create') {
                const created = await categoriesService.createCategory(serverId, categoryForm.value);
                onCategoriesChange?.(prev => [...prev, created]);
            } else if (categoryForm.category) {
                const updated = await categoriesService.renameCategory(serverId, categoryForm.category.id, categoryForm.value);
                onCategoriesChange?.(prev => prev.map(c => c.id === updated.id ? updated : c));
            }
            setCategoryForm(null);
        } catch (err) {
            const error = err as { response?: { data?: { detail?: string } } };
            setCategoryForm(prev => prev && { ...prev, loading: false, error: error.response?.data?.detail || 'Error' });
        }
    };

    const confirmCategoryDelete = async () => {
        if (!pendingDeleteCat) return;
        const { id } = pendingDeleteCat;
        setPendingDeleteCat(null);
        try {
            await categoriesService.deleteCategory(serverId, id);
            onCategoriesChange?.(prev => prev.filter(c => c.id !== id));
            onChannelsChange(prev => prev.map(c => c.category_id === id ? { ...c, category_id: null } : c));
        } catch (err) {
            const error = err as { response?: { data?: { detail?: string } } };
            window.alert(error.response?.data?.detail || 'Error al eliminar la categoría');
        }
    };

    const handleChannelReorder = async (groupChannels: Channel[], fromId: string, toId: string) => {
        const fromIndex = groupChannels.findIndex(c => c.id === fromId);
        const toIndex = groupChannels.findIndex(c => c.id === toId);
        if (fromIndex === -1 || toIndex === -1) return;

        const reordered = [...groupChannels];
        const [item] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, item);

        // Build the full global order: replace the group's channels with the reordered ones,
        // keeping every other channel in place. This avoids position collisions across groups.
        const groupIds = new Set(groupChannels.map(c => c.id));
        const globalSorted = [...channels].sort((a, b) => a.position - b.position);
        let reorderedIdx = 0;
        const newGlobalOrder = globalSorted.map(c =>
            groupIds.has(c.id) ? reordered[reorderedIdx++] : c
        );

        const newPositions = new Map(newGlobalOrder.map((c, i) => [c.id, i]));
        onChannelsChange(prev =>
            prev.map(c => ({ ...c, position: newPositions.get(c.id) ?? c.position }))
        );

        try {
            await channelsService.reorderChannels(serverId, newGlobalOrder.map(c => c.id));
        } catch {
            // Silently revert on error — the next server refresh will restore the real order
        }
    };

    const handleAssignChannelToCategory = async (channelId: string, categoryId: string | null) => {
        onChannelsChange(prev => prev.map(c => c.id === channelId ? { ...c, category_id: categoryId } : c));
        try {
            await channelsService.updateChannel(serverId, channelId, undefined, undefined, categoryId ?? '');
        } catch (err) {
            const error = err as { response?: { data?: { detail?: string } } };
            window.alert(error.response?.data?.detail || 'Error al mover el canal');
        }
    };

    const handleCategoryReorder = async (fromId: string, toId: string) => {
        const sorted = [...categories].sort((a, b) => a.position - b.position);
        const fromIndex = sorted.findIndex(c => c.id === fromId);
        const toIndex = sorted.findIndex(c => c.id === toId);
        if (fromIndex === -1 || toIndex === -1) return;

        const reordered = [...sorted];
        const [item] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, item);

        onCategoriesChange?.(prev => {
            const newPositions = new Map(reordered.map((c, i) => [c.id, i]));
            return prev.map(c => newPositions.has(c.id) ? { ...c, position: newPositions.get(c.id)! } : c);
        });

        try {
            await categoriesService.reorderCategories(serverId, reordered.map(c => c.id));
        } catch {
            // Silently revert on error
        }
    };

    const groupProps = {
        activeId: activeChannelId,
        serverId,
        canManage,
        onDelete: (id: string, name: string) => setPendingDelete({ id, name }),
        onEdit: setPendingEdit,
        renderBelowChannel,
    };

    return (
        <>
            {canManage && (
                <div className="px-2 pb-1">
                    <button
                        onClick={() => setCategoryForm({ mode: 'create', value: '', loading: false, error: null })}
                        className="flex items-center gap-1 text-xs py-1 px-1 rounded transition-colors w-full"
                        style={{ color: '#8e9297' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#dcddde')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#8e9297')}
                        title="Crear categoría"
                    >
                        <FolderPlus size={13} />
                        <span>Nueva categoría</span>
                    </button>
                </div>
            )}

            {[...categories].sort((a, b) => a.position - b.position).map((cat, idx, sorted) => {
                const catChannels = channels.filter(c => c.category_id === cat.id).sort((a, b) => a.position - b.position);
                return (
                    <div key={cat.id}>
                        <ChannelGroup
                            label={cat.name}
                            channels={catChannels}
                            onReorder={(fromId, toId) => handleChannelReorder(catChannels, fromId, toId)}
                            onChannelDrop={canManage ? (channelId) => handleAssignChannelToCategory(channelId, cat.id) : undefined}
                            headerActions={canManage ? (
                                <>
                                    <button
                                        onClick={() => handleCategoryReorder(cat.id, sorted[idx - 1].id)}
                                        disabled={idx === 0}
                                        className="p-0.5 rounded disabled:opacity-30"
                                        style={{ color: '#8e9297' }}
                                        title="Subir categoría"
                                        onMouseEnter={e => { if (idx !== 0) e.currentTarget.style.color = '#dcddde'; }}
                                        onMouseLeave={e => (e.currentTarget.style.color = '#8e9297')}
                                    >
                                        <ChevronUp size={12} />
                                    </button>
                                    <button
                                        onClick={() => handleCategoryReorder(cat.id, sorted[idx + 1].id)}
                                        disabled={idx === sorted.length - 1}
                                        className="p-0.5 rounded disabled:opacity-30"
                                        style={{ color: '#8e9297' }}
                                        title="Bajar categoría"
                                        onMouseEnter={e => { if (idx !== sorted.length - 1) e.currentTarget.style.color = '#dcddde'; }}
                                        onMouseLeave={e => (e.currentTarget.style.color = '#8e9297')}
                                    >
                                        <ChevronDown size={12} />
                                    </button>
                                    <button
                                        onClick={() => setCategoryForm({ mode: 'rename', category: cat, value: cat.name, loading: false, error: null })}
                                        className="p-0.5 rounded"
                                        style={{ color: '#8e9297' }}
                                        title="Renombrar categoría"
                                        onMouseEnter={e => (e.currentTarget.style.color = '#dcddde')}
                                        onMouseLeave={e => (e.currentTarget.style.color = '#8e9297')}
                                    >
                                        <Pencil size={12} />
                                    </button>
                                    <button
                                        onClick={() => setPendingDeleteCat({ id: cat.id, name: cat.name })}
                                        className="p-0.5 rounded"
                                        style={{ color: '#8e9297' }}
                                        title="Eliminar categoría"
                                        onMouseEnter={e => (e.currentTarget.style.color = '#ed4245')}
                                        onMouseLeave={e => (e.currentTarget.style.color = '#8e9297')}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </>
                            ) : undefined}
                            {...groupProps}
                        />
                    </div>
                );
            })}

            {(() => {
                const textChannels = channels.filter(c => c.type === 'text' && !c.category_id).sort((a, b) => a.position - b.position);
                const voiceChannels = channels.filter(c => c.type === 'voice' && !c.category_id).sort((a, b) => a.position - b.position);
                return (
                    <>
                        <ChannelGroup
                            label="Canales de texto"
                            channels={textChannels}
                            onAdd={() => setCreateType('text')}
                            onReorder={(fromId, toId) => handleChannelReorder(textChannels, fromId, toId)}
                            onChannelDrop={canManage ? (channelId) => handleAssignChannelToCategory(channelId, null) : undefined}
                            {...groupProps}
                        />
                        <ChannelGroup
                            label="Canales de voz"
                            channels={voiceChannels}
                            onAdd={() => setCreateType('voice')}
                            onReorder={(fromId, toId) => handleChannelReorder(voiceChannels, fromId, toId)}
                            onChannelDrop={canManage ? (channelId) => handleAssignChannelToCategory(channelId, null) : undefined}
                            {...groupProps}
                        />
                    </>
                );
            })()}

            {createType && (
                <CreateChannelModal
                    serverId={serverId}
                    type={createType}
                    onClose={() => setCreateType(null)}
                    onCreated={handleChannelCreated}
                />
            )}

            {pendingEdit && (
                <EditChannelModal
                    serverId={serverId}
                    channel={pendingEdit}
                    categories={categories}
                    onClose={() => setPendingEdit(null)}
                    onUpdated={handleChannelUpdated}
                />
            )}

            {pendingDelete && (
                <ConfirmModal
                    title="Eliminar canal"
                    message={`¿Eliminar #${pendingDelete.name}? Esta acción no se puede deshacer.`}
                    confirmLabel="Eliminar"
                    danger
                    onConfirm={confirmChannelDelete}
                    onCancel={() => setPendingDelete(null)}
                />
            )}

            {categoryForm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.7)' }}
                    onClick={() => setCategoryForm(null)}
                >
                    <div
                        className="relative w-full max-w-md rounded-2xl p-8 shadow-2xl"
                        style={{ background: '#36393f' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-black text-white mb-6" style={{ fontFamily: 'Nunito, sans-serif' }}>
                            {categoryForm.mode === 'create' ? 'Nueva categoría' : 'Renombrar categoría'}
                        </h2>
                        <input
                            value={categoryForm.value}
                            onChange={e => setCategoryForm(prev => prev && { ...prev, value: e.target.value })}
                            placeholder="Nombre de la categoría"
                            className="w-full px-4 py-3 rounded-lg text-sm text-white outline-none placeholder-gray-500 mb-4"
                            style={{ background: '#23272a', border: '1.5px solid transparent' }}
                            onFocus={e => (e.currentTarget.style.borderColor = '#7289da')}
                            onBlur={e => (e.currentTarget.style.borderColor = 'transparent')}
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') submitCategoryForm(); }}
                        />
                        {categoryForm.error && (
                            <p className="text-sm mb-4" style={{ color: '#ed4245' }}>{categoryForm.error}</p>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCategoryForm(null)}
                                className="flex-1 py-3 rounded-lg text-sm font-bold transition-all"
                                style={{ background: '#4f545c', color: '#fff' }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={submitCategoryForm}
                                disabled={categoryForm.loading || !categoryForm.value.trim()}
                                className="flex-1 py-3 rounded-lg text-sm font-bold text-white transition-all"
                                style={{
                                    background: categoryForm.loading || !categoryForm.value.trim() ? '#5b6eae' : '#7289da',
                                    cursor: categoryForm.loading || !categoryForm.value.trim() ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {categoryForm.loading ? 'Guardando...' : categoryForm.mode === 'create' ? 'Crear' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {pendingDeleteCat && (
                <ConfirmModal
                    title="Eliminar categoría"
                    message={`¿Eliminar la categoría "${pendingDeleteCat.name}"? Los canales dentro quedarán sin categoría.`}
                    confirmLabel="Eliminar"
                    danger
                    onConfirm={confirmCategoryDelete}
                    onCancel={() => setPendingDeleteCat(null)}
                />
            )}
        </>
    );
};
