import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createMessagesService } from './service';
import type { MessageDto } from './types';

const edited: MessageDto = {
    messageId: 'm1',
    channelId: 'c1',
    serverId: 's1',
    authorId: 'u1',
    content: 'corregido',
    createdAt: '2026-11-09T12:00:00Z',
    editedAt: '2026-11-09T12:05:00.123Z',
    clientMessageId: 'cm1',
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
});
