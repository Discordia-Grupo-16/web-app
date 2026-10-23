import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { PERMISSION_COPY, authorView, useAuth, usePublicProfiles } from '@discordia/core';
import type { ServerBan } from '@discordia/api';
import { RevokeBanDialog } from './RevokeBanDialog';

interface BansSectionProps {
  serverId: string;
  bans: ServerBan[];
  /** The list could not be loaded: says so instead of "nobody is banned". */
  error?: boolean;
  onBanRevoked: (userId: string) => void;
}

/**
 * The bans of the server, with the action to revoke each one (SCRUM-70).
 *
 * Only rendered for whoever has BAN_MEMBERS: the list is moderation data and the backend
 * refuses it to everyone else.
 */
export function BansSection({ serverId, bans, error = false, onBanRevoked }: BansSectionProps) {
  const { user } = useAuth();
  const [revoking, setRevoking] = useState<string | null>(null);

  // Both the banned users and the moderators who banned them are `identity`'s: one request
  // resolves every name in the section.
  const profiles = usePublicProfiles(bans.flatMap(ban => [ban.user_id, ban.banned_by]));

  const nameOf = (userId: string) => authorView(userId, user, profiles.get(userId)).name;

  return (
    <>
      <View className="flex-row items-center justify-between px-1 mt-2">
        <Text className="text-[#8e9297] text-xs font-semibold uppercase tracking-widest">
          {PERMISSION_COPY.bansTitle(bans.length)}
        </Text>
      </View>

      {error && (
        <Text accessibilityRole="alert" className="text-[#ed4245] text-xs px-1">
          {PERMISSION_COPY.bansError}
        </Text>
      )}

      {!error && bans.length === 0 && (
        <Text className="text-[#72767d] text-xs px-1">{PERMISSION_COPY.noBans}</Text>
      )}

      {bans.map(({ user_id, banned_by, reason, created_at }) => (
        <View key={user_id} className="bg-[#2c2f33] rounded-lg px-4 py-3 flex-row items-center">
          <View className="flex-1 min-w-0">
            <Text className="text-[#dcddde] text-sm" numberOfLines={1}>
              {nameOf(user_id)}
            </Text>
            <Text className="text-[#72767d] text-xs mt-0.5" numberOfLines={1}>
              {PERMISSION_COPY.bannedOn(nameOf(banned_by), created_at)}
            </Text>
            {/* Se guardó "para los moderadores" al banear: acá es donde lo leen,
                antes de decidir si revocan. */}
            {/* Un ternario y no `&&`: un string vacío suelto fuera de un <Text>
                rompe en React Native. */}
            {reason ? (
              <Text className="text-[#72767d] text-xs mt-0.5" numberOfLines={2}>
                {PERMISSION_COPY.banReason(reason)}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={() => setRevoking(user_id)}
            accessibilityRole="button"
            accessibilityLabel={PERMISSION_COPY.revokeBan(nameOf(user_id))}
            className="pl-3"
          >
            {/* Con la flecha como "Roles ›": abre un modal, y el ícono de la web
                no tiene equivalente acá. */}
            <Text className="text-[#7289da] text-xs">Revocar ›</Text>
          </TouchableOpacity>
        </View>
      ))}

      {revoking && (
        <RevokeBanDialog
          visible
          serverId={serverId}
          userId={revoking}
          memberName={nameOf(revoking)}
          onClose={() => setRevoking(null)}
          onRevoked={onBanRevoked}
        />
      )}
    </>
  );
}
