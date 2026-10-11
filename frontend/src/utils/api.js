import axios from 'axios';
import store from '../store';

// Production: VITE_API_URL points at the hosted API (e.g. Render).
// Development: '/api' goes through the Vite proxy to localhost:5000.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  // Render's free tier can take up to a minute to wake up
  timeout: 30000,
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

// A message the user can act on, instead of a generic failure
export const describeError = (err, fallback) => {
  if (err.response?.data?.message) return err.response.data.message;
  if (err.code === 'ECONNABORTED') {
    return 'The server took too long to respond. It may be waking up — please try again in a minute.';
  }
  if (!err.response) {
    return 'Cannot reach the server. Check your internet connection, or the server address settings.';
  }
  return `${fallback} (error ${err.response.status})`;
};

export default api;