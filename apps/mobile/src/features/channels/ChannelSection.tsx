import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { useRouter } from 'expo-router';
import type { Channel } from '@discordia/api';
import { channelsService } from '@/shared/api';
import { SectionHeader } from '@/shared/ui/SectionHeader';
import { ChannelItem } from './ChannelItem';
import { CreateChannelModal } from './CreateChannelModal';
import { EditChannelModal } from './EditChannelModal';
import { getErrorDetail } from '@discordia/api';

interface ChannelSectionProps {
  serverId: string;
  channels: Channel[];
  canManage: boolean;
  /** The section does not own the channels: the server does. */
  onChannelsChange: (update: (channels: Channel[]) => Channel[]) => void;
}

// Text and voice channels of a server. Only text channels open (into the chat).
export function ChannelSection({ serverId, channels, canManage, onChannelsChange }: ChannelSectionProps) {
  const router = useRouter();
  const [createChannelType, setCreateChannelType] = useState<'text' | 'voice' | null>(null);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);

  const textChannels = channels.filter(c => c.type === 'text');
  const voiceChannels = channels.filter(c => c.type === 'voice');

  const handleOpenChannel = (ch: Channel) => {
    router.push({
      pathname: '/server/[serverId]/channel/[channelId]',
      params: { serverId, channelId: ch.id, name: ch.name },
    });
  };

  const handleEditChannel = (updated: Channel) => {
    onChannelsChange(prev => prev.map(c => c.id === updated.id ? updated : c));
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
              await channelsService.deleteChannel(serverId, ch.id);
              onChannelsChange(prev => prev.filter(c => c.id !== ch.id));
            } catch (err) {
              Alert.alert('Error', getErrorDetail(err) || 'No se pudo eliminar el canal.');
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <SectionHeader
        title="Canales de texto"
        canManage={canManage}
        onAdd={() => setCreateChannelType('text')}
      />
      {textChannels.length === 0 && (
        <Text className="text-[#72767d] text-xs px-1">Sin canales de texto.</Text>
      )}
      {textChannels.map(ch => (
        <ChannelItem
          key={ch.id}
          channel={ch}
          canManage={canManage}
          onDelete={handleDeleteChannel}
          onEdit={setEditingChannel}
          onOpen={handleOpenChannel}
        />
      ))}

      <SectionHeader
        title="Canales de voz"
        canManage={canManage}
        onAdd={() => setCreateChannelType('voice')}
      />
      {voiceChannels.length === 0 && (
        <Text className="text-[#72767d] text-xs px-1">Sin canales de voz.</Text>
      )}
      {voiceChannels.map(ch => (
        <ChannelItem key={ch.id} channel={ch} canManage={canManage} onDelete={handleDeleteChannel} onEdit={setEditingChannel} />
      ))}

      {editingChannel && (
        <EditChannelModal
          channel={editingChannel}
          serverId={serverId}
          onClose={() => setEditingChannel(null)}
          onUpdated={handleEditChannel}
        />
      )}

      {createChannelType && (
        <CreateChannelModal
          type={createChannelType}
          onClose={() => setCreateChannelType(null)}
          onCreated={ch => {
            onChannelsChange(prev => [...prev, ch]);
            setCreateChannelType(null);
          }}
          serverId={serverId}
        />
      )}
    </>
  );
}
