import { CONNECT, VIEW_CHANNEL, hasPermission } from '../permissions/permissions';

/** Los bits que pide unirse a un canal de voz: VIEW_CHANNEL y CONNECT (ADR-0011). */
export const VOICE_JOIN_PERMISSIONS = VIEW_CHANNEL | CONNECT;

/**
 * Si el bitmask de servidor (`Server.my_permissions`) alcanza para unirse a un canal de voz.
 * ADMINISTRATOR no se chequea aparte: community lo manda expandido.
 */
export const canJoinVoice = (permissions: number): boolean => hasPermission(permissions, VOICE_JOIN_PERMISSIONS);
