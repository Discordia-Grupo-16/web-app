/**
 * Server permissions, on the client side (ADR-0011).
 *
 * `community` computes them and they arrive already resolved in
 * `my_permissions`: this module only checks bits. No role rule is
 * reimplemented here — not the OR of the roles, not the owner, not the
 * hierarchy.
 *
 * It is the only place in the front end that knows the numbers, so that web
 * and mobile cannot drift apart.
 */

/** No permission at all. The safe default when the server has not loaded yet. */
export const NONE = 0;

export const VIEW_CHANNEL = 1 << 0;
export const SEND_MESSAGES = 1 << 1;
export const CONNECT = 1 << 2;
export const MANAGE_CHANNELS = 1 << 3;
export const MANAGE_ROLES = 1 << 4;
export const KICK_MEMBERS = 1 << 5;
export const BAN_MEMBERS = 1 << 6;
export const MANAGE_SERVER = 1 << 7;
export const ADMINISTRATOR = 1 << 8;
export const MANAGE_MESSAGES = 1 << 9;
export const CREATE_INVITE = 1 << 10;
export const ADD_REACTIONS = 1 << 11;
export const MENTION_EVERYONE = 1 << 12;
export const ATTACH_FILES = 1 << 13;
export const MODERATE_MEMBERS = 1 << 14;
export const VIEW_AUDIT_LOG = 1 << 15;

/** The name of each permission, as the API sends and expects it. */
export const PERMISSION_BY_NAME = {
    VIEW_CHANNEL,
    SEND_MESSAGES,
    CONNECT,
    MANAGE_CHANNELS,
    MANAGE_ROLES,
    KICK_MEMBERS,
    BAN_MEMBERS,
    MANAGE_SERVER,
    ADMINISTRATOR,
    MANAGE_MESSAGES,
    CREATE_INVITE,
    ADD_REACTIONS,
    MENTION_EVERYONE,
    ATTACH_FILES,
    MODERATE_MEMBERS,
    VIEW_AUDIT_LOG,
} as const;

export type PermissionName = keyof typeof PERMISSION_BY_NAME;

/** The permissions in display order: the everyday ones first. */
export const PERMISSION_ORDER: PermissionName[] = [
    'VIEW_CHANNEL',
    'SEND_MESSAGES',
    'ADD_REACTIONS',
    'ATTACH_FILES',
    'MENTION_EVERYONE',
    'CONNECT',
    'CREATE_INVITE',
    'MANAGE_CHANNELS',
    'MANAGE_MESSAGES',
    'MANAGE_ROLES',
    'MODERATE_MEMBERS',
    'KICK_MEMBERS',
    'BAN_MEMBERS',
    'VIEW_AUDIT_LOG',
    'MANAGE_SERVER',
    'ADMINISTRATOR',
];

/** Interface text. The raw names are never shown to the user. */
export const PERMISSION_LABEL: Record<PermissionName, string> = {
    VIEW_CHANNEL: 'Ver canales',
    SEND_MESSAGES: 'Enviar mensajes',
    CONNECT: 'Entrar a canales de voz',
    MANAGE_CHANNELS: 'Gestionar canales',
    MANAGE_MESSAGES: 'Gestionar mensajes',
    MANAGE_ROLES: 'Gestionar roles',
    KICK_MEMBERS: 'Expulsar miembros',
    BAN_MEMBERS: 'Banear miembros',
    MANAGE_SERVER: 'Administrar el servidor',
    ADMINISTRATOR: 'Administrador',
    CREATE_INVITE: 'Invitar miembros',
    ADD_REACTIONS: 'Agregar reacciones',
    MENTION_EVERYONE: 'Mencionar a todos y a roles',
    ATTACH_FILES: 'Adjuntar archivos',
    MODERATE_MEMBERS: 'Moderar miembros',
    VIEW_AUDIT_LOG: 'Ver el registro de auditoría',
};

/** One hint per permission, so the screen is not a blind list of switches. */
export const PERMISSION_HINT: Record<PermissionName, string> = {
    VIEW_CHANNEL: 'Ver los canales del servidor y su historial.',
    SEND_MESSAGES: 'Escribir en los canales de texto.',
    CONNECT: 'Unirse a los canales de voz.',
    MANAGE_CHANNELS: 'Crear, editar y eliminar canales.',
    MANAGE_MESSAGES: 'Eliminar mensajes de otros miembros.',
    MANAGE_ROLES: 'Crear roles, editar sus permisos y asignarlos.',
    KICK_MEMBERS: 'Expulsar miembros del servidor.',
    BAN_MEMBERS: 'Banear miembros e impedir que vuelvan a entrar.',
    MANAGE_SERVER: 'Editar el nombre, el ícono y la configuración.',
    ADMINISTRATOR: 'Concede todos los permisos. Darlo equivale a dar el servidor.',
    CREATE_INVITE: 'Crear, ver y revocar las invitaciones del servidor.',
    ADD_REACTIONS: 'Reaccionar a los mensajes con emojis.',
    MENTION_EVERYONE: 'Usar @everyone y mencionar roles para avisarles a muchos a la vez.',
    ATTACH_FILES: 'Subir imágenes y archivos en los mensajes.',
    MODERATE_MEMBERS: 'Silenciar temporalmente a miembros y editar las palabras prohibidas.',
    VIEW_AUDIT_LOG: 'Ver quién expulsó, baneó o silenció a quién, y cuándo.',
};

/**
 * Tells whether a bitmask grants a permission.
 *
 * `ADMINISTRATOR` is not checked here: the backend sends it already expanded,
 * so an administrator arrives with every bit set. Repeating that rule would
 * mean writing the same decision in two places.
 */
export const hasPermission = (permissions: number, permission: number): boolean =>
    (permissions & permission) === permission;

/** Translates a bitmask into names, in `PERMISSION_ORDER`. */
export const toPermissionNames = (permissions: number): PermissionName[] =>
    PERMISSION_ORDER.filter(name => hasPermission(permissions, PERMISSION_BY_NAME[name]));

/** Builds the bitmask from the names, ignoring the ones it does not know. */
export const fromPermissionNames = (names: readonly string[]): number =>
    names.reduce(
        (mask, name) =>
            name in PERMISSION_BY_NAME
                ? mask | PERMISSION_BY_NAME[name as PermissionName]
                : mask,
        0,
    );

/** Adds or removes a permission from a bitmask, for the screen's checkboxes. */
export const togglePermission = (
    permissions: number,
    permission: number,
    enabled: boolean,
): number => (enabled ? permissions | permission : permissions & ~permission);
