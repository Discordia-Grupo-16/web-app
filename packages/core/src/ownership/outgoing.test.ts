import type { OwnershipTransfer } from '@discordia/api';
import { describe, expect, it } from 'vitest';
import { toOutgoingView } from './outgoing';

const transfer = (overrides: Partial<OwnershipTransfer> = {}): OwnershipTransfer => ({
    server_id: 'srv',
    server_name: 'Grupo 16',
    from_user_id: 'owner',
    to_user_id: 'member',
    status: 'pending',
    created_at: '2026-11-05T10:00:00Z',
    resolved_at: null,
    ...overrides,
});

describe('toOutgoingView', () => {
    it('shows nothing when the server never had a transfer', () => {
        expect(toOutgoingView(null, null)).toEqual({ kind: 'none' });
    });

    it('shows the pending transfer with its recipient', () => {
        expect(toOutgoingView(transfer(), null)).toEqual({
            kind: 'pending',
            toUserId: 'member',
            createdAt: '2026-11-05T10:00:00Z',
        });
    });

    it('shows a rejection until the owner closes it', () => {
        expect(toOutgoingView(transfer({ status: 'rejected' }), null)).toEqual({
            kind: 'rejected',
            toUserId: 'member',
            createdAt: '2026-11-05T10:00:00Z',
        });
    });

    it('hides the rejection the owner closed on this device', () => {
        expect(toOutgoingView(transfer({ status: 'rejected' }), '2026-11-05T10:00:00Z')).toEqual({ kind: 'none' });
    });

    it('shows a later rejection even if an earlier one was closed', () => {
        expect(toOutgoingView(transfer({ status: 'rejected' }), '2026-11-04T09:00:00Z')).toEqual({
            kind: 'rejected',
            toUserId: 'member',
            createdAt: '2026-11-05T10:00:00Z',
        });
    });

    it.each(['accepted', 'cancelled'] as const)('shows nothing for a %s transfer', (status) => {
        expect(toOutgoingView(transfer({ status }), null)).toEqual({ kind: 'none' });
    });
});
