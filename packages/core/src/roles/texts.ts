import type { RoleDeletionError } from './types';

// The same texts on web and mobile (SCRUM-64, Eliminar rol).
export const ROLE_DELETION_TEXTS = {
    action: 'Eliminar',
    actionLabel: (roleName: string) => `Eliminar el rol ${roleName}`,
    title: 'Eliminar rol',
    confirm: (roleName: string) => `¿Eliminar el rol ${roleName}? Esta acción no se puede deshacer.`,
    confirmButton: 'Eliminar',
    deleting: 'Eliminando...',
    cancel: 'Cancelar',
    close: 'Cerrar',
    retry: 'Reintentar',
    defaultRole: 'Es el rol por defecto. Elegí otro rol por defecto antes de eliminarlo',
    soleAdmin: 'No podés eliminar este rol: es el que te da la administración del servidor',
    rejectedFallback: 'No tenés permiso para eliminar roles',
    roleGone: 'Ese rol ya no existe',
    serverGone: 'El servidor ya no existe',
    network: 'No hay conexión.',
    service: 'No se pudo completar. Reintentá',
} as const;

export const roleDeletionErrorText = (error: RoleDeletionError): string => {
    switch (error.kind) {
        case 'rejected':
            return error.message;
        case 'server-gone':
            return ROLE_DELETION_TEXTS.serverGone;
        case 'network':
            return ROLE_DELETION_TEXTS.network;
        case 'service':
            return ROLE_DELETION_TEXTS.service;
    }
};
