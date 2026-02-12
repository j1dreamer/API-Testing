import axios from 'axios';

// Default config
const apiClient = axios.create({
    baseURL: 'http://localhost:8001', // Direct connection to Toolkit to bypass proxy issues
    headers: {
        'Content-Type': 'application/json',
    },
});

// Auth Interceptors Removed per user request

export default apiClient;
