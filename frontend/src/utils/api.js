import axios from 'axios';
import store from '../store';

// Production: VITE_API_URL points at the hosted API (e.g. Render).
// Development: '/api' goes through the Vite proxy to localhost:5000.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
});

// Read token from Redux store directly — not localStorage
// This is the most reliable source since Redux is always in sync
api.interceptors.request.use((config) => {
  // Primary: get from Redux store (always current)
  const state = store.getState();
  const token = state.auth?.token || localStorage.getItem('zammarket_token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('zammarket_token');
      localStorage.removeItem('zammarket_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;