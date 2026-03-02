import axios from 'axios';

const apiClient = axios.create({
    baseURL: '/api' // All requests must start with /api for backend router to catch them
});

// Request Interceptor: Attach Token & Headers
apiClient.interceptors.request.use((config) => {
    if (isRedirecting) {
        // Cancel request if we are already logging out
        return Promise.reject(new Error("Logging out..."));
    }
    const token = sessionStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['X-ION-API-VERSION'] = '22';
    config.headers['X-ION-CLIENT-TYPE'] = 'InstantOn';
    config.headers['X-ION-CLIENT-PLATFORM'] = 'web';

    // Add user email for backend stateless logging
    const email = sessionStorage.getItem('insight_user_email');
    if (email) {
        config.headers['X-Insight-User'] = email;
    }
    return config;
}, (error) => Promise.reject(error));

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    if (i < 0) return '0 B';
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

let isRedirecting = false;
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Response Interceptor: Handle 401/403 with Auto-Refresh
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        const status = error.response ? error.response.status : null;

        // Không auto-refresh cho các auth endpoints để tránh vòng lặp vô tận
        const isAuthEndpoint = originalRequest.url?.includes('/login')
            || originalRequest.url?.includes('/auth/refresh')
            || originalRequest.url?.includes('/auth/session');

        if ((status === 401 || status === 403) && !originalRequest._retry && !isAuthEndpoint) {
            if (isRefreshing) {
                console.warn('SecurityService: Token refresh đang diễn ra, queuing request...');
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers['Authorization'] = 'Bearer ' + token;
                    return apiClient(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;
            console.warn('SecurityService: Acquiring refresh lock...');

            try {
                const refreshToken = sessionStorage.getItem('refresh_token');
                if (!refreshToken) throw new Error("Không tìm thấy refresh_token trong sessionStorage");

                // Dùng axios gốc (không qua apiClient) để tránh trigger interceptor lần nữa
                const res = await axios.post('/api/auth/refresh', { refresh_token: refreshToken });
                const newToken = res.data?.token_value;
                const newRefresh = res.data?.refresh_token;

                if (!newToken) throw new Error("refresh endpoint không trả về token");

                sessionStorage.setItem('token', newToken);
                if (newRefresh) sessionStorage.setItem('refresh_token', newRefresh);

                originalRequest.headers['Authorization'] = 'Bearer ' + newToken;
                console.warn('SecurityService: Token refreshed thành công');

                processQueue(null, newToken);
                return apiClient(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);

                if (!isRedirecting) {
                    isRedirecting = true;
                    console.error(`Phiên hết hạn (${status}) và refresh thất bại. Đang đăng xuất...`);
                    sessionStorage.clear();
                    localStorage.clear();
                    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
                        if (window.location.pathname === '/') {
                            window.location.reload();
                        } else {
                            window.location.href = '/';
                        }
                    });
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
                console.warn('SecurityService: Refresh lock released');
            }
        }

        return Promise.reject(error);
    }
);

export { formatBytes };
export default apiClient;
