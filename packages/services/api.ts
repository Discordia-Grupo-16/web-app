import axios, { type AxiosInstance } from 'axios';
import type { AuthStorageStrategy } from '@discordia/context';

interface ApiConfig {
    baseURL: string;
    timeout?: number;
    storage: AuthStorageStrategy;
}

export function createApiClient({ baseURL, timeout, storage }: ApiConfig): AxiosInstance {
    const api = axios.create({
        baseURL,
        timeout,
        headers: {
            'Content-Type': 'application/json',
        },
    });

    // Interceptor para inyectar el token en cada petición
    api.interceptors.request.use(
        async (config) => {
            const token = await storage.getToken();
            if (token && config.headers) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        },
        (error) => Promise.reject(error)
    );

    return api;
}