import type { VoiceDisconnectReason, VoiceJoinError } from './types';

// The same texts on web and mobile.
export const VOICE_TEXTS = {
    connecting: 'Conectando…',
    noMic: 'Estás conectado sin micrófono: los demás no te escuchan.',
    micBlockedWeb:
        'El navegador tiene bloqueado el micrófono para este sitio. Habilitalo desde el ícono del candado en la barra de direcciones y volvé a unirte.',
    micBlockedMobile: 'El permiso del micrófono está bloqueado. Habilitalo desde la configuración de la app.',
    micBlockedMobileInCall: 'Abrir la configuración corta la llamada.',
    openSettings: 'Abrir configuración',
    leave: 'Salir de la llamada',
    reconnecting: 'Reconectando…',
    rejoin: 'Volver a unirse',
    connectedTo: 'Conectado a',
} as const;

export const VOICE_JOIN_ERROR_TEXTS: Record<VoiceJoinError, string> = {
    forbidden: 'No tenés permiso para unirte a este canal.',
    'not-found': 'Este canal ya no existe.',
    'not-voice': 'Este canal no es de voz.',
    unavailable: 'La voz no está disponible en este momento.',
    network: 'No hay conexión.',
};

export const VOICE_DISCONNECT_TEXTS: Record<VoiceDisconnectReason, string> = {
    other_device: 'Te uniste desde otro dispositivo.',
    left_server: 'Saliste del servidor.',
    kicked: 'Te expulsaron del servidor.',
    banned: 'Te bloquearon en el servidor.',
    suspended: 'Tu cuenta fue suspendida.',
    permissions_revoked: 'Ya no tenés permiso para estar en este canal.',
    channel_deleted: 'El canal se eliminó.',
    connection_lost: 'Se perdió la conexión con la llamada.',
    app_backgrounded: 'La llamada se cortó porque saliste de la app.',
};

export const isRetryableJoinError = (error: VoiceJoinError): boolean => error === 'unavailable' || error === 'network';

// Involuntary exits that offer "Volver a unirse": connection_lost and app_backgrounded.
// Provisional body: never offers it.
export const canRejoin = (reason: VoiceDisconnectReason): boolean => {
    void reason;
    return false;
};
