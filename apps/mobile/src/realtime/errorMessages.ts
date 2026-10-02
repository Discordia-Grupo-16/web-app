import type { PendingErrorCode } from '@discordia/core';

// The server's error.message is not shown as is: these are the UI texts.
export const ERROR_TEXTS: Record<PendingErrorCode, string> = {
  INTERNAL_ERROR: 'No se pudo enviar.',
  TIMEOUT: 'No hubo respuesta del servidor.',
  DISCONNECTED: 'Se perdió la conexión.',
  FORBIDDEN: 'No tenés permiso para escribir en este canal.',
  CHANNEL_NOT_FOUND: 'Este canal ya no existe.',
  // These two never stay as a failed message (see rejectionMessage), the record just has to be total.
  EMPTY_MESSAGE: 'No se puede enviar un mensaje vacío.',
  MESSAGE_TOO_LONG: 'El mensaje supera el límite de caracteres.',
};

// Text for a message the server rejected and that goes back to the composer instead of staying failed.
export const rejectionMessage = (code: 'EMPTY_MESSAGE' | 'MESSAGE_TOO_LONG', maxLength: number): string =>
  code === 'EMPTY_MESSAGE' ? ERROR_TEXTS.EMPTY_MESSAGE : `El mensaje supera el límite de ${maxLength} caracteres.`;

// Only transient failures can be retried; FORBIDDEN and CHANNEL_NOT_FOUND would fail again.
export const isRetryable = (code: PendingErrorCode | undefined): boolean =>
  code === 'INTERNAL_ERROR' || code === 'TIMEOUT' || code === 'DISCONNECTED';
