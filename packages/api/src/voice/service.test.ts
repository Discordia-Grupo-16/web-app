import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createVoiceService } from './service';
import type { VoiceToken } from './types';

const token: VoiceToken = {
    token: 'jwt',
    url: 'wss://voice.example.com',
    roomName: 'channel-1',
    expiresAt: '2026-10-13T12:10:00Z',
};

describe('createVoiceService createVoiceToken', () => {
    it('asks for the token of the channel and unwraps data', async () => {
        const apiClient = { post: vi.fn(async () => ({ data: { data: token } })) };
        const service = createVoiceService(apiClient as unknown as AxiosInstance);

        const result = await service.createVoiceToken('channel-1');

        expect(apiClient.post).toHaveBeenCalledWith('/api/v1/channels/channel-1/voice-tokens');
        expect(result).toEqual(token);
    });

    it('propagates the Axios error with its status', async () => {
        const error = Object.assign(new Error('Request failed'), { isAxiosError: true, response: { status: 403 } });
        const apiClient = { post: vi.fn(async () => Promise.reject(error)) };
        const service = createVoiceService(apiClient as unknown as AxiosInstance);

        await expect(service.createVoiceToken('channel-1')).rejects.toMatchObject({ response: { status: 403 } });
    });
});
