// Shared by web and mobile so the invite link, its parsing and its error texts cannot drift apart.

export const buildInviteUrl = (webBaseUrl: string, code: string): string =>
    `${webBaseUrl.replace(/\/+$/, '')}/invite/${code}`;

const INVITE_LINK = /^(?:https?:\/\/[^/\s]+\/|discordia:\/\/)invite\/([^/?#\s]+)\/?(?:[?#].*)?$/i;
// The alphabet of the codes `community` generates (token_urlsafe): anything else is not a code, and
// keeping it out stops `..` or encoded separators from reaching the request path.
const CODE = /^[A-Za-z0-9_-]+$/;

// Accepts a bare code, an http(s) link ending in /invite/<code> or discordia://invite/<code>.
export const parseInviteCode = (input: string): string | null => {
    const text = input.trim();
    const candidate = INVITE_LINK.exec(text)?.[1] ?? text;
    return CODE.test(candidate) ? candidate : null;
};

const ERROR_MESSAGES: Record<number, string> = {
    404: 'La invitación no existe.',
    410: 'Esta invitación ya no es válida (expirada o sin usos disponibles).',
    403: 'No podés unirte a este servidor.',
};

export const invitationErrorMessage = (status?: number): string =>
    (status !== undefined && ERROR_MESSAGES[status]) || 'Ocurrió un error al procesar la invitación.';
