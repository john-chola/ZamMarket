import { io } from 'socket.io-client';

let socket = null;

// Use environment variable in production, localhost in development
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const getSocket = () => socket;

export const initSocket = (token) => {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect',       () => console.log('🟢 Socket connected'));
  socket.on('disconnect',    (r) => console.log('🔴 Socket disconnected:', r));
  socket.on('connect_error', (e) => console.warn('Socket error:', e.message));

  return socket;
};

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null; }
};