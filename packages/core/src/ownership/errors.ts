import type { OwnershipAction, OwnershipFailure } from './types';

export const classifyOwnershipError = (_error: unknown, _action: OwnershipAction): OwnershipFailure => 'service';
