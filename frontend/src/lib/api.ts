import axios from 'axios';

// Use /api as the base path — Next.js rewrites proxy these to the backend.
// This keeps all requests same-origin, eliminating CORS issues.
const baseURL = '/api';

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

// Request interceptor to attach the auth token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor to handle 401s globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // We can handle global 401s here if needed
    // Typically handled by Zustand actions or react-query error boundaries
    return Promise.reject(error);
  }
);
