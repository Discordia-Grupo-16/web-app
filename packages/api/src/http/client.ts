import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { AuthStorageStrategy } from './storage';

interface ApiConfig {
    baseURL: string;
    timeout?: number;
    storage: AuthStorageStrategy;
    /** The server rejected the session for good: the user has to log in again (login CA 4). */
    onSessionExpired?: () => void;
}

interface CustomRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

export function createApiClient({ baseURL, timeout, storage, onSessionExpired }: ApiConfig): AxiosInstance {
    const api = axios.create({
        baseURL,
        timeout,
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
                // Only a request that carried a token says something about the session: a 401 for
                // someone who never logged in (e.g. an invitation preview) is not an expiry.
                if (originalRequest.headers?.Authorization) onSessionExpired?.();
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
                // Without an answer from the server (offline, timeout) the refresh token may still be
                // good: keep the session and let the next request try again.
                if (axios.isAxiosError(refreshError) && refreshError.response) {
                    await storage.clearSession();
                    onSessionExpired?.();
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }
    );

    return api;
}