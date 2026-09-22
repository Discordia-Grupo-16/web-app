import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { AuthStorageStrategy } from '@discordia/context';

interface ApiConfig {
    baseURL: string;
    timeout?: number;
    storage: AuthStorageStrategy;
}

interface CustomRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

export function createApiClient({ baseURL, timeout, storage }: ApiConfig): AxiosInstance {
    const api = axios.create({
        baseURL,
        timeout,
        headers: {
            'Content-Type': 'application/json',
        },
    });

    let isRefreshing = false;
    let refreshSubscribers: ((token: string) => void)[] = [];

    const onRefreshed = (token: string) => {
        refreshSubscribers.forEach((callback) => callback(token));
        refreshSubscribers = [];
    };

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

    // Interceptor para renovar sesión automáticamente al expirar el access token (CA4)
    api.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config as CustomRequestConfig | undefined;

            if (!originalRequest || !error.response || error.response.status !== 401) {
                return Promise.reject(error);
            }

            // No intentar refresco en endpoints de login ni en el propio refresh
            const isAuthEndpoint =
                originalRequest.url?.includes('/sessions') &&
                originalRequest.method?.toLowerCase() === 'post';

            if (isAuthEndpoint || originalRequest._retry) {
                return Promise.reject(error);
            }

            const refreshToken = storage.getRefreshToken
                ? await storage.getRefreshToken()
                : null;

            if (!refreshToken) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise((resolve) => {
                    refreshSubscribers.push((newToken: string) => {
                        if (originalRequest.headers) {
                            originalRequest.headers.Authorization = `Bearer ${newToken}`;
                        }
                        resolve(api(originalRequest));
                    });
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const response = await axios.post<{
                    data: { accessToken: string; refreshToken: string };
                }>(
                    `${baseURL}/api/v1/sessions/refresh`,
                    { refreshToken },
                    {
                        headers: { 'Content-Type': 'application/json' },
                        timeout,
                    }
                );

                const newAccessToken = response.data.data.accessToken;
                const newRefreshToken = response.data.data.refreshToken;

                await storage.setToken(newAccessToken);
                if (storage.setRefreshToken && newRefreshToken) {
                    await storage.setRefreshToken(newRefreshToken);
                }

                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                }

                onRefreshed(newAccessToken);
                return api(originalRequest);
            } catch (refreshError) {
                refreshSubscribers = [];
                await storage.clearSession();
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }
    );

    return api;
}