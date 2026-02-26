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

        // Check if error is 401/403 and we haven't retried yet
        // Do not auto-refresh for explicit authentication endpoints
        const isAuthEndpoint = originalRequest.url?.includes('/login') || originalRequest.url?.includes('/auth-session');

        if ((status === 401 || status === 403) && !originalRequest._retry && !isAuthEndpoint) {
            if (isRefreshing) {
                console.warn('SecurityService: Access Token refresh already in progress, waiting...');
                // If currently refreshing, queue this request
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
            console.warn('SecurityService: Refresh Token Lock acquired, proceeding with refresh');

            try {
                // Try to get a new token via backend (using base axios to avoid infinite loops)
                // Note: use the backend session auth endpoint to get a fresh token if session is still alive
                const res = await axios.get('/api/cloner/auth-session');
                const newToken = res.data?.token_value || res.data?.token;

                if (newToken) {
                    // Update token in storage
                    sessionStorage.setItem('token', newToken);

                    // Update original request with new token
                    originalRequest.headers['Authorization'] = 'Bearer ' + newToken;

                    console.warn('Access token refreshed');

                    // Process awaiting queue
                    processQueue(null, newToken);

                    // Retry original request
                    return apiClient(originalRequest);
                } else {
                    throw new Error("No token returned from auto-refresh");
                }
            } catch (refreshError) {
                // Auto-refresh failed, proceed with normal logout
                processQueue(refreshError, null);

                if (!isRedirecting) {
                    isRedirecting = true;
                    console.error(`Session expired (${status}) & Auto-refresh failed. Cleaning up...`);

                    // Clear all session and local storage
                    sessionStorage.clear();
                    localStorage.clear();

                    // Notify backend to clear its in-memory session
                    fetch('/api/cloner/logout', { method: 'POST' }).finally(() => {
                        // Hard redirect to root
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
                console.warn('SecurityService: Token Refresh Lock released');
            }
        }

        return Promise.reject(error);
    }
);

export { formatBytes };
export default apiClient;
