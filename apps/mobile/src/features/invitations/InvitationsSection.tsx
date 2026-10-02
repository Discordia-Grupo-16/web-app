import { useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import type { Invitation } from '@discordia/api';
import { invitationsService } from '@/shared/api';
import { InvitationsModal } from './InvitationsModal';

// Only the owner manages invitations: the list is fetched each time the modal opens.
export function InvitationsSection({ serverId, canManage }: { serverId: string; canManage: boolean }) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showInvitations, setShowInvitations] = useState(false);

  if (!canManage) return null;

  return (
    <>
      <TouchableOpacity
        onPress={async () => {
          const list = await invitationsService.listInvitations(serverId).catch(() => []);
          setInvitations(list);
          setShowInvitations(true);
        }}
        className="bg-[#2c2f33] rounded-xl px-4 py-3 flex-row items-center justify-between mt-2"
      >
        <Text className="text-[#7289da] font-semibold">Gestionar invitaciones</Text>
        <Text className="text-[#7289da] text-lg">›</Text>
      </TouchableOpacity>

      <InvitationsModal
        visible={showInvitations}
        serverId={serverId}
        invitations={invitations}
        onClose={() => setShowInvitations(false)}
        onRevoked={code => setInvitations(prev => prev.filter(i => i.code !== code))}
        onCreated={inv => setInvitations(prev => [...prev, inv])}
      />
    </>
  );
}
