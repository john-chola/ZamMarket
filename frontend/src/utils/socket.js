import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => socket;

export const initSocket = (token) => {
  if (socket?.connected) return socket;

  // Production: VITE_SOCKET_URL points at the hosted API.
  // Development: same origin, forwarded by the Vite proxy.
  socket = io(import.meta.env.VITE_SOCKET_URL || undefined, {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => console.log('🟢 Socket connected'));
  socket.on('disconnect', (reason) => console.log('🔴 Socket disconnected:', reason));
  socket.on('connect_error', (err) => console.warn('Socket error:', err.message));

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};