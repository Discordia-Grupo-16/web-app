import { useLocalSearchParams } from 'expo-router';
import { JoinScreen } from './JoinScreen';

/**
 * Landing of the `discordia://invite/<code>` deep link. It only brings the code to the join form:
 * the user still confirms before joining. The confirmation screen (server preview, uses left)
 * replaces this one in the invitation parity work.
 */
export function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <JoinScreen initialCode={Array.isArray(code) ? code[0] : code} />;
}
