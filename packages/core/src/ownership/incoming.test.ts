import type { OwnershipTransfer } from '@discordia/api';
import { describe, expect, it } from 'vitest';
import { visibleIncoming } from './incoming';

const pending = (serverId: string): OwnershipTransfer => ({
    server_id: serverId,
    server_name: `Servidor ${serverId}`,
    from_user_id: 'owner',
    to_user_id: 'me',
    status: 'pending',
    created_at: '2026-11-05T10:00:00Z',
    resolved_at: null,
});

describe('visibleIncoming', () => {
    it('keeps the transfers of servers I am still in, in the order they came', () => {
        const transfers = [pending('b'), pending('a'), pending('c')];

        expect(visibleIncoming(transfers, new Set(['a', 'b', 'c']))).toEqual(transfers);
    });

    it('drops the transfers of servers that are no longer in my list', () => {
        const result = visibleIncoming([pending('kept'), pending('deleted')], new Set(['kept']));

        expect(result.map((t) => t.server_id)).toEqual(['kept']);
    });

    it('shows nothing when I have no servers left', () => {
        expect(visibleIncoming([pending('a')], new Set())).toEqual([]);
    });
});
