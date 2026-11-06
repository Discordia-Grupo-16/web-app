import type { OwnershipError } from './types';

// The same texts on web and mobile.
export const OWNERSHIP_TEXTS = {
    transfer: 'Transferir propiedad',
    proposeConfirm: (toName: string, serverName: string) =>
        `¿Transferir la propiedad de ${serverName} a ${toName}? Si acepta, vas a dejar de ser el owner.`,
    pendingTo: (toName: string) => `Transferencia pendiente a ${toName}`,
    rejectedBy: (toName: string) => `${toName} rechazó la transferencia`,
    incoming: (fromName: string, serverName: string) => `${fromName} te propone ser el owner de ${serverName}`,
    acceptConfirm: (serverName: string) => `Vas a ser el owner de ${serverName}`,
    leaveAsOwner: 'Para abandonar el servidor, primero transferí la propiedad o eliminá el servidor.',
    leaveAsOwnerWithPending: (toName: string) =>
        `Para abandonar el servidor, primero transferí la propiedad o eliminá el servidor. Ya hay una transferencia pendiente a ${toName}.`,
    accept: 'Aceptar',
    reject: 'Rechazar',
    cancel: 'Cancelar',
    retry: 'Reintentar',
    close: 'Cerrar',
    // Never the id: a partial id is not a name.
    loadingName: 'Cargando…',
} as const;

export const ownershipErrorText = (error: OwnershipError): string => {
    switch (error.kind) {
        case 'not-owner':
            return 'Solo el owner puede transferir la propiedad';
        case 'not-member':
            return 'Esa persona ya no es miembro del servidor';
        case 'already-pending':
            return `Ya hay una transferencia pendiente a ${error.toName}`;
        case 'unavailable':
            return 'Esta transferencia ya no está disponible';
        case 'server-gone':
            return 'El servidor ya no existe';
        case 'network':
            return 'No hay conexión.';
        case 'service':
            return 'No se pudo completar. Reintentá';
    }
};
