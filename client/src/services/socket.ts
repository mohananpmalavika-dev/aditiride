import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socketInstance.on('connect', () => {
      console.log('⚡ Socket.IO connected to AditiRide real-time engine:', socketInstance?.id);
    });

    socketInstance.on('disconnect', () => {
      console.warn('⚠️ Socket.IO disconnected from AditiRide engine');
    });
  }

  return socketInstance;
}

export const socket = getSocket();
