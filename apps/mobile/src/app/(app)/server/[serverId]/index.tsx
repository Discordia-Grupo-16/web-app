import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator,
  Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useAuth } from '@discordia/context';
import { getServer, leaveServer, deleteServer } from '@/services/serversService';
import { createChannel, updateChannel, deleteChannel } from '@/services/channelsService';
import { createRole, listRoles } from '@/services/rolesService';
import { createInvitation, listInvitations, revokeInvitation } from '@/services/invitationsService';
import type { Server } from '@/types/server';
import type { Channel } from '@/types/channel';
import type { Role } from '@/types/role';
import type { Invitation } from '@/types/invitation';
import { isGoneError, useFocusedPolling } from '@/hooks/useFocusedPolling';

export default function ServerScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { user } = useAuth();

  const [server, setServer] = useState<Server | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const [createChannelType, setCreateChannelType] = useState<'text' | 'voice' | null>(null);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);

  const isOwner = !!user && server?.owner_id === user.id;

  const load = async () => {
    if (!serverId) return;
    setLoading(true);
    try {
      const [srv, roleList] = await Promise.all([getServer(serverId), listRoles(serverId)]);
      setServer(srv);
      setRoles(roleList);
      navigation.setOptions({ title: srv.name });
    } catch {
      Alert.alert('Error', 'No se pudo cargar el servidor.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [serverId]);

  // Channels created or deleted from another client show up on focus and on the next poll.
  // If the server itself is gone (deleted, or we were removed), go back to the list.
  const goneRef = useRef(false);
  useFocusedPolling(() => {
    if (!serverId || goneRef.current) return;
    getServer(serverId)
      .then(srv => {
        setServer(prev => prev && prev.id === srv.id ? { ...prev, channels: srv.channels } : prev);
      })
      .catch(err => {
        if (!isGoneError(err) || goneRef.current) return;
        goneRef.current = true;
        Alert.alert('Servidor no disponible', 'Este servidor fue eliminado o ya no sos miembro.');
        router.back();
      });
  });

  const handleOpenChannel = (ch: Channel) => {
    router.push({
      pathname: '/server/[serverId]/channel/[channelId]',
      params: { serverId, channelId: ch.id, name: ch.name },
    });
  };

  const handleEditChannel = (updated: Channel) => {
    setServer(prev => prev
      ? { ...prev, channels: prev.channels.map(c => c.id === updated.id ? updated : c) }
      : prev);
    setEditingChannel(null);
  };

  const handleDeleteChannel = (ch: Channel) => {
    Alert.alert(
      'Eliminar canal',
      `¿Eliminar #${ch.name}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive', onPress: async () => {
            try {
              await deleteChannel(serverId!, ch.id);
              setServer(prev => prev
                ? { ...prev, channels: prev.channels.filter(c => c.id !== ch.id) }
                : prev);
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.detail || 'No se pudo eliminar el canal.');
            }
          },
        },
      ],
    );
  };

  const handleLeave = () => {
    Alert.alert('Abandonar servidor', '¿Seguro que querés salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', style: 'destructive', onPress: async () => {
          try {
            goneRef.current = true;
            await leaveServer(serverId!);
            router.back();
          } catch (err: any) {
            goneRef.current = false;
            Alert.alert('Error', err?.response?.data?.detail || 'No se pudo abandonar el servidor.');
          }
        },
      },
    ]);
  };

  const handleDeleteServer = () => {
    Alert.alert('Eliminar servidor', `¿Eliminar "${server?.name}"? Esta acción es permanente.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try {
            goneRef.current = true;
            await deleteServer(serverId!);
            router.back();
          } catch (err: any) {
            goneRef.current = false;
            Alert.alert('Error', err?.response?.data?.detail || 'No se pudo eliminar el servidor.');
          }
        },
      },
    ]);
  };

  const textChannels = server?.channels.filter(c => c.type === 'text') ?? [];
  const voiceChannels = server?.channels.filter(c => c.type === 'voice') ?? [];

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#23272a]">
        <ActivityIndicator color="#7289da" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#23272a]" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>

        {/* Canales de texto */}
        <SectionHeader
          title="Canales de texto"
          canManage={isOwner}
          onAdd={() => setCreateChannelType('text')}
        />
        {textChannels.length === 0 && (
          <Text className="text-[#72767d] text-xs px-1">Sin canales de texto.</Text>
        )}
        {textChannels.map(ch => (
          <ChannelItem
            key={ch.id}
            channel={ch}
            canManage={isOwner}
            onDelete={handleDeleteChannel}
            onEdit={setEditingChannel}
            onOpen={handleOpenChannel}
          />
        ))}

        {/* Canales de voz */}
        <SectionHeader
          title="Canales de voz"
          canManage={isOwner}
          onAdd={() => setCreateChannelType('voice')}
        />
        {voiceChannels.length === 0 && (
          <Text className="text-[#72767d] text-xs px-1">Sin canales de voz.</Text>
        )}
        {voiceChannels.map(ch => (
          <ChannelItem key={ch.id} channel={ch} canManage={isOwner} onDelete={handleDeleteChannel} onEdit={setEditingChannel} />
        ))}

        {/* Roles */}
        <SectionHeader title="Roles" canManage={isOwner} onAdd={() => setShowCreateRole(true)} />
        {roles.length === 0 && (
          <Text className="text-[#72767d] text-xs px-1">Sin roles creados.</Text>
        )}
        {roles.map(role => (
          <View key={role.id} className="bg-[#2c2f33] rounded-lg px-4 py-3">
            <Text className="text-[#dcddde] text-sm">🛡 {role.name}</Text>
          </View>
        ))}

        {/* Invitaciones */}
        {isOwner && (
          <TouchableOpacity
            onPress={async () => {
              const list = await listInvitations(serverId!).catch(() => []);
              setInvitations(list);
              setShowInvitations(true);
            }}
            className="bg-[#2c2f33] rounded-xl px-4 py-3 flex-row items-center justify-between mt-2"
          >
            <Text className="text-[#7289da] font-semibold">Gestionar invitaciones</Text>
            <Text className="text-[#7289da] text-lg">›</Text>
          </TouchableOpacity>
        )}

        {/* Acciones del servidor */}
        <View className="gap-3 mt-4">
          {!isOwner && (
            <TouchableOpacity
              onPress={handleLeave}
              className="bg-[#2c2f33] py-3 rounded-xl items-center border border-[#ed4245]"
            >
              <Text className="text-[#ed4245] font-bold">Abandonar servidor</Text>
            </TouchableOpacity>
          )}
          {isOwner && (
            <TouchableOpacity
              onPress={handleDeleteServer}
              className="bg-[#ed4245]/10 py-3 rounded-xl items-center border border-[#ed4245]"
            >
              <Text className="text-[#ed4245] font-bold">Eliminar servidor</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Modals */}
      {editingChannel && (
        <EditChannelModal
          channel={editingChannel}
          serverId={serverId!}
          onClose={() => setEditingChannel(null)}
          onUpdated={handleEditChannel}
        />
      )}

      {createChannelType && (
        <CreateChannelModal
          type={createChannelType}
          onClose={() => setCreateChannelType(null)}
          onCreated={ch => {
            setServer(prev => prev ? { ...prev, channels: [...prev.channels, ch] } : prev);
            setCreateChannelType(null);
          }}
          serverId={serverId!}
        />
      )}

      <CreateRoleModal
        visible={showCreateRole}
        serverId={serverId!}
        onClose={() => setShowCreateRole(false)}
        onCreated={role => { setRoles(prev => [...prev, role]); setShowCreateRole(false); }}
      />

      <InvitationsModal
        visible={showInvitations}
        serverId={serverId!}
        invitations={invitations}
        onClose={() => setShowInvitations(false)}
        onRevoked={code => setInvitations(prev => prev.filter(i => i.code !== code))}
        onCreated={inv => setInvitations(prev => [...prev, inv])}
      />
    </SafeAreaView>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SectionHeader({ title, canManage, onAdd }: {
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

function ChannelItem({ channel, canManage, onDelete, onEdit, onOpen }: {
  channel: Channel; canManage: boolean;
  onDelete: (ch: Channel) => void; onEdit: (ch: Channel) => void; onOpen?: (ch: Channel) => void;
}) {
  const prefix = channel.type === 'text' ? '#' : '🔊';
  const content = (
    <>
      <Text className="text-[#dcddde] text-sm flex-1">
        {prefix} {channel.name}
      </Text>
      {canManage && (
        <View className="flex-row gap-2 ml-3">
          <TouchableOpacity onPress={() => onEdit(channel)} className="p-1">
            <Text className="text-[#72767d] text-base">✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(channel)} className="p-1">
            <Text className="text-[#72767d] text-base">🗑</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
  const rowClass = 'bg-[#2c2f33] rounded-lg px-4 py-3 flex-row items-center justify-between';

  // Only channels with an onOpen handler (text) are tappable; the delete button keeps its own onPress.
  if (!onOpen) return <View className={rowClass}>{content}</View>;
  return (
    <TouchableOpacity className={rowClass} onPress={() => onOpen(channel)}>
      {content}
    </TouchableOpacity>
  );
}

function EditChannelModal({ channel, serverId, onClose, onUpdated }: {
  channel: Channel; serverId: string;
  onClose: () => void; onUpdated: (ch: Channel) => void;
}) {
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await updateChannel(
        serverId,
        channel.id,
        name.toLowerCase().replace(/\s+/g, '-'),
        channel.type === 'text' ? topic || undefined : undefined,
      );
      onUpdated(updated);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.map((d: any) => d.msg).join(', ') : (detail || 'Error al editar el canal'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-[#36393f] rounded-t-2xl p-6">
          <Text className="text-white font-black text-xl mb-1">Editar canal</Text>
          <Text className="text-[#99aab5] text-sm mb-5">
            Canal de {channel.type === 'text' ? 'texto' : 'voz'}
          </Text>
          <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider mb-1">
            Nombre *
          </Text>
          <TextInput
            value={name}
            onChangeText={v => setName(v.toLowerCase().replace(/\s+/g, '-'))}
            placeholder="nombre-del-canal"
            placeholderTextColor="#72767d"
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            className="bg-[#23272a] text-white rounded-lg px-4 py-3 mb-4"
          />
          {channel.type === 'text' && (
            <>
              <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider mb-1">
                Tema (opcional)
              </Text>
              <TextInput
                value={topic}
                onChangeText={setTopic}
                placeholder="De qué se trata este canal"
                placeholderTextColor="#72767d"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                className="bg-[#23272a] text-white rounded-lg px-4 py-3 mb-4"
              />
            </>
          )}
          {error ? <Text className="text-[#ed4245] text-sm mb-3">{error}</Text> : null}
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading || !name.trim()}
            className="bg-[#7289da] py-3 rounded-xl items-center mb-2"
            style={{ opacity: loading || !name.trim() ? 0.6 : 1 }}
          >
            <Text className="text-white font-bold">{loading ? 'Guardando…' : 'Guardar cambios'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setError(null); onClose(); }} className="py-3 items-center">
            <Text className="text-[#99aab5]">Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function CreateChannelModal({ type, serverId, onClose, onCreated }: {
  type: 'text' | 'voice'; serverId: string;
  onClose: () => void; onCreated: (ch: Channel) => void;
}) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const ch = await createChannel(serverId, name.toLowerCase().replace(/\s+/g, '-'), type);
      setName('');
      onCreated(ch);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.map((d: any) => d.msg).join(', ') : (detail || 'Error al crear el canal'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-[#36393f] rounded-t-2xl p-6">
          <Text className="text-white font-black text-xl mb-1">Crear canal</Text>
          <Text className="text-[#99aab5] text-sm mb-5">
            Canal de {type === 'text' ? 'texto' : 'voz'}
          </Text>
          <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider mb-1">
            Nombre *
          </Text>
          <TextInput
            value={name}
            onChangeText={v => setName(v.toLowerCase().replace(/\s+/g, '-'))}
            placeholder={type === 'text' ? 'nuevo-canal' : 'voz-general'}
            placeholderTextColor="#72767d"
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            className="bg-[#23272a] text-white rounded-lg px-4 py-3 mb-4"
          />
          {error ? <Text className="text-[#ed4245] text-sm mb-3">{error}</Text> : null}
          <TouchableOpacity
            onPress={handleCreate}
            disabled={loading || !name.trim()}
            className="bg-[#7289da] py-3 rounded-xl items-center mb-2"
            style={{ opacity: loading || !name.trim() ? 0.6 : 1 }}
          >
            <Text className="text-white font-bold">{loading ? 'Creando…' : 'Crear canal'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setName(''); setError(null); onClose(); }} className="py-3 items-center">
            <Text className="text-[#99aab5]">Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function CreateRoleModal({ visible, serverId, onClose, onCreated }: {
  visible: boolean; serverId: string;
  onClose: () => void; onCreated: (r: Role) => void;
}) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const role = await createRole(serverId, name.trim());
      setName('');
      onCreated(role);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.map((d: any) => d.msg).join(', ') : (detail || 'Error al crear el rol'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-[#36393f] rounded-t-2xl p-6">
          <Text className="text-white font-black text-xl mb-1">Crear rol</Text>
          <Text className="text-[#99aab5] text-sm mb-5">
            Se crea con permisos por defecto al final de la jerarquía.
          </Text>
          <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider mb-1">
            Nombre *
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Moderador"
            placeholderTextColor="#72767d"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            className="bg-[#23272a] text-white rounded-lg px-4 py-3 mb-4"
          />
          {error ? <Text className="text-[#ed4245] text-sm mb-3">{error}</Text> : null}
          <TouchableOpacity
            onPress={handleCreate}
            disabled={loading || !name.trim()}
            className="bg-[#7289da] py-3 rounded-xl items-center mb-2"
            style={{ opacity: loading || !name.trim() ? 0.6 : 1 }}
          >
            <Text className="text-white font-bold">{loading ? 'Creando…' : 'Crear rol'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setName(''); setError(null); onClose(); }} className="py-3 items-center">
            <Text className="text-[#99aab5]">Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const EXPIRY_OPTIONS: { label: string; value: number | undefined }[] = [
  { label: 'Sin exp.', value: undefined },
  { label: '1 h', value: 1 },
  { label: '6 h', value: 6 },
  { label: '24 h', value: 24 },
  { label: '7 d', value: 168 },
];

function InvitationsModal({ visible, serverId, invitations, onClose, onRevoked, onCreated }: {
  visible: boolean; serverId: string; invitations: Invitation[];
  onClose: () => void; onRevoked: (code: string) => void; onCreated: (inv: Invitation) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState<number | undefined>(undefined);
  const [maxUsesInput, setMaxUsesInput] = useState('');

  const handleCreate = async () => {
    setCreating(true);
    try {
      const maxUses = maxUsesInput ? parseInt(maxUsesInput, 10) : undefined;
      const inv = await createInvitation(serverId, expiresInHours, maxUses);
      onCreated(inv);
      setMaxUsesInput('');
      setExpiresInHours(undefined);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'No se pudo crear la invitación.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = (code: string) => {
    Alert.alert('Revocar invitación', `¿Revocar el código "${code}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Revocar', style: 'destructive', onPress: async () => {
          try {
            await revokeInvitation(serverId, code);
            onRevoked(code);
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.detail || 'No se pudo revocar.');
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-[#36393f] rounded-t-2xl p-6" style={{ maxHeight: '80%' }}>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-white font-black text-xl">Invitaciones</Text>
            <TouchableOpacity onPress={onClose}>
              <Text className="text-[#99aab5] text-2xl leading-6">×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 300 }} className="mb-4">
            {invitations.length === 0 && (
              <Text className="text-[#99aab5] text-sm text-center py-4">
                No hay invitaciones activas.
              </Text>
            )}
            {invitations.map(inv => (
              <View key={inv.id} className="bg-[#2c2f33] rounded-lg px-4 py-3 mb-2 flex-row items-center justify-between">
                <View className="flex-1 mr-3">
                  <Text className="text-white font-mono text-sm">{inv.code}</Text>
                  <Text className="text-[#72767d] text-xs mt-0.5">
                    Usos: {inv.uses}{inv.max_uses ? `/${inv.max_uses}` : ''}
                    {inv.expires_at ? `  ·  Expira: ${new Date(inv.expires_at).toLocaleDateString()}` : ''}
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={async () => { await Clipboard.setStringAsync(inv.code); Alert.alert('Copiado', `Código ${inv.code} copiado.`); }}
                    className="bg-[#7289da] px-3 py-1.5 rounded-lg"
                  >
                    <Text className="text-white text-xs font-semibold">Copiar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRevoke(inv.code)}
                    className="bg-[#ed4245]/20 px-3 py-1.5 rounded-lg"
                  >
                    <Text className="text-[#ed4245] text-xs font-semibold">Revocar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>

          <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider mb-2">
            Expiración
          </Text>
          <View className="flex-row gap-2 mb-4 flex-wrap">
            {EXPIRY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={String(opt.value)}
                onPress={() => setExpiresInHours(opt.value)}
                className="px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: expiresInHours === opt.value ? '#7289da' : '#2c2f33' }}
              >
                <Text style={{ color: expiresInHours === opt.value ? '#fff' : '#99aab5', fontSize: 12 }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider mb-2">
            Límite de usos (opcional)
          </Text>
          <TextInput
            value={maxUsesInput}
            onChangeText={v => setMaxUsesInput(v.replace(/[^0-9]/g, ''))}
            placeholder="Sin límite"
            placeholderTextColor="#72767d"
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            className="bg-[#23272a] text-white rounded-lg px-4 py-3 mb-4"
          />

          <TouchableOpacity
            onPress={handleCreate}
            disabled={creating}
            className="bg-[#7289da] py-3 rounded-xl items-center"
            style={{ opacity: creating ? 0.6 : 1 }}
          >
            <Text className="text-white font-bold">
              {creating ? 'Creando…' : '+ Nueva invitación'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
