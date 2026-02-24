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

// Response Interceptor: Handle 401/403
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        const status = error.response ? error.response.status : null;
        if (status === 401 || status === 403) {
            if (!isRedirecting) {
                isRedirecting = true;
                console.error(`Session expired (${status}). Cleaning up...`);

                // Clear all session and local storage
                sessionStorage.clear();
                localStorage.clear();

                // Notify backend to clear its in-memory session
                // Use fetch instead of apiClient to avoid interceptor loops
                fetch('/api/cloner/logout', { method: 'POST' }).finally(() => {
                    // Hard redirect to root
                    if (window.location.pathname === '/') {
                        window.location.reload();
                    } else {
                        window.location.href = '/';
                    }
                });
            }
        }
        return Promise.reject(error);
    }
);

export { formatBytes };
export default apiClient;
