import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createMessagesService } from './service';
import type { MessageDto, MessageReactionsDto } from './types';

const edited: MessageDto = {
    messageId: 'm1',
    channelId: 'c1',
    serverId: 's1',
    authorId: 'u1',
    content: 'corregido',
    createdAt: '2026-11-09T12:00:00Z',
    editedAt: '2026-11-09T12:05:00.123Z',
    clientMessageId: 'cm1',
    reactions: [],
    reactionsVersion: 0,
};

const reacted: MessageReactionsDto = {
    messageId: 'm1',
    reactions: [{ emoji: '👍🏽', userIds: ['u1'] }],
    reactionsVersion: 1,
};

describe('createMessagesService', () => {
    it('editMessage sends the content to the message and unwraps data', async () => {
        const apiClient = { patch: vi.fn(async () => ({ data: { data: edited } })) };
        const service = createMessagesService(apiClient as unknown as AxiosInstance);

        const result = await service.editMessage('c1', 'm1', 'corregido');

        expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/channels/c1/messages/m1', { content: 'corregido' });
        expect(result).toEqual(edited);
    });

    it('editMessage lets the error through: the caller decides what to tell the user', async () => {
        const failure = Object.assign(new Error('forbidden'), { response: { status: 403 } });
        const apiClient = { patch: vi.fn(async () => { throw failure; }) };
        const service = createMessagesService(apiClient as unknown as AxiosInstance);

        await expect(service.editMessage('c1', 'm1', 'x')).rejects.toBe(failure);
    });

    it('deleteMessage deletes that message of that channel and resolves with nothing', async () => {
        const apiClient = { delete: vi.fn(async () => ({ status: 204, data: '' })) };
        const service = createMessagesService(apiClient as unknown as AxiosInstance);

        await expect(service.deleteMessage('c1', 'm1')).resolves.toBeUndefined();

        expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/channels/c1/messages/m1');
    });

    it('deleteMessage lets the error through', async () => {
        const failure = Object.assign(new Error('forbidden'), { response: { status: 403 } });
        const apiClient = { delete: vi.fn(async () => { throw failure; }) };
        const service = createMessagesService(apiClient as unknown as AxiosInstance);

        await expect(service.deleteMessage('c1', 'm1')).rejects.toBe(failure);
    });

    // The emoji travels in the path. Without encoding, `#` would cut the path into a fragment and the
    // skin tone or keycap bytes would depend on the HTTP library.
    it.each([
        ['a skin tone modifier', '👍🏽', '%F0%9F%91%8D%F0%9F%8F%BD'],
        ['a keycap that starts with #', '#️⃣', '%23%EF%B8%8F%E2%83%A3'],
    ])('addReaction puts the emoji with %s percent-encoded in the path and unwraps data', async (_case, emoji, encoded) => {
        const apiClient = { put: vi.fn(async () => ({ data: { data: reacted } })) };
        const service = createMessagesService(apiClient as unknown as AxiosInstance);

        const result = await service.addReaction('c1', 'm1', emoji);

        expect(apiClient.put).toHaveBeenCalledWith(`/api/v1/channels/c1/messages/m1/reactions/${encoded}`);
        expect(result).toEqual(reacted);
    });

    it('removeReaction deletes the reaction with the emoji encoded and unwraps data', async () => {
        const removed: MessageReactionsDto = { messageId: 'm1', reactions: [], reactionsVersion: 2 };
        const apiClient = { delete: vi.fn(async () => ({ data: { data: removed } })) };
        const service = createMessagesService(apiClient as unknown as AxiosInstance);

        const result = await service.removeReaction('c1', 'm1', '#️⃣');

        expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/channels/c1/messages/m1/reactions/%23%EF%B8%8F%E2%83%A3');
        expect(result).toEqual(removed);
    });

    it('addReaction lets the error through: the caller turns the status into text', async () => {
        const failure = Object.assign(new Error('conflict'), { response: { status: 409 } });
        const apiClient = { put: vi.fn(async () => { throw failure; }) };
        const service = createMessagesService(apiClient as unknown as AxiosInstance);

        await expect(service.addReaction('c1', 'm1', '👍')).rejects.toBe(failure);
    });
});
