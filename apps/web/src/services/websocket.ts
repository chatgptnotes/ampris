import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/authStore';

const WS_URL = import.meta.env.VITE_WS_URL || '';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: false,
      auth: {
        token: useAuthStore.getState().accessToken,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
    });
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  s.auth = { token: useAuthStore.getState().accessToken };
  if (!s.connected) {
    s.connect();
  }
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/** Subscribe to specific tags. */
export function subscribeTags(tags: string[]): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('subscribe:tags', tags);
  }
}

/** Unsubscribe from specific tags. */
export function unsubscribeTags(tags: string[]): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('unsubscribe:tags', tags);
  }
}
