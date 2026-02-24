import axios from 'axios';

const apiClient = axios.create({
    baseURL: '/api' // All requests must start with /api for backend router to catch them
});

// Request Interceptor: Attach Token
apiClient.interceptors.request.use((config) => {
    const token = sessionStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => Promise.reject(error));

// Response Interceptor: Handle 401
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Trigger global event to logout user immediately
            window.dispatchEvent(new Event('unauthorized'));
        }
        return Promise.reject(error);
    }
);

export default apiClient;
