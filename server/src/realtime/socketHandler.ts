import { Server, Socket } from 'socket.io';
import { run, get } from '../db/index.js';
import { DriverProfile } from '../types/index.js';

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Join user-specific notification channel
    socket.on('join_user', (userId: string) => {
      socket.join(`user_${userId}`);
      console.log(`[Socket.IO] ${socket.id} joined channel user_${userId}`);
    });

    // Join room for specific active booking
    socket.on('join_booking', (bookingId: string) => {
      socket.join(`booking_${bookingId}`);
      console.log(`[Socket.IO] ${socket.id} joined room booking_${bookingId}`);
    });

    // Driver broadcasts real-time GPS location
    socket.on('driver_location_update', (data: { driverId: string; lat: number; lng: number; heading: number; bookingId?: string }) => {
      const { driverId, lat, lng, heading, bookingId } = data;
      
      run(
        `UPDATE driver_profiles 
         SET current_lat = ?, current_lng = ?, heading = ?, last_location_update = datetime('now')
         WHERE id = ?`,
        [lat, lng, heading || 0, driverId]
      );

      if (bookingId) {
        io.to(`booking_${bookingId}`).emit('driver_moved', { driverId, lat, lng, heading });
      }

      io.emit('driver_telematics_global', { driverId, lat, lng, heading });
    });

    // Booking state change broadcast
    socket.on('booking_state_updated', (data: { bookingId: string; status: string; booking: any }) => {
      io.to(`booking_${data.bookingId}`).emit('booking_status_changed', data);
      io.emit('admin_booking_updated', data);
    });

    // In-trip Passenger <-> Driver Chat
    socket.on('send_chat_message', (data: {
      bookingId: string;
      senderId: string;
      senderName: string;
      senderRole: string;
      message: string;
      receiverId?: string;
    }) => {
      const msgId = `msg_${Date.now()}`;
      run(`
        INSERT INTO chat_messages (id, booking_id, sender_id, sender_role, message)
        VALUES (?, ?, ?, ?, ?)
      `, [msgId, data.bookingId, data.senderId, data.senderRole, data.message]);

      const messagePayload = {
        id: msgId,
        ...data,
        createdAt: new Date().toISOString()
      };

      io.to(`booking_${data.bookingId}`).emit('new_chat_message', messagePayload);
      if (data.receiverId) {
        io.to(`user_${data.receiverId}`).emit('new_chat_message', messagePayload);
      }
    });

    // ==========================================
    // IN-APP VOIP & AUDIO CALL SIGNALING
    // ==========================================
    socket.on('call_initiate', (data: {
      bookingId: string;
      callerId: string;
      callerName: string;
      callerRole: 'PASSENGER' | 'DRIVER';
      callerAvatar?: string;
      receiverId: string;
      receiverName: string;
    }) => {
      console.log(`[Call] Initiate call from ${data.callerName} (${data.callerRole}) to receiver ${data.receiverId}`);
      const callSessionId = `call_${Date.now()}`;
      
      const callData = {
        ...data,
        callSessionId,
        timestamp: Date.now(),
        virtualRelayNumber: '+91 484-719-0099'
      };

      // Broadcast incoming call to receiver's user channel and booking room
      io.to(`user_${data.receiverId}`).emit('incoming_call', callData);
      io.to(`booking_${data.bookingId}`).emit('call_ringing', callData);
    });

    socket.on('call_accept', (data: { bookingId: string; callSessionId: string; callerId: string; receiverId: string }) => {
      console.log(`[Call] Call accepted for session ${data.callSessionId}`);
      io.to(`booking_${data.bookingId}`).emit('call_connected', data);
      io.to(`user_${data.callerId}`).emit('call_connected', data);
    });

    socket.on('call_reject', (data: { bookingId: string; callSessionId: string; callerId: string; receiverId: string; reason?: string }) => {
      console.log(`[Call] Call rejected for session ${data.callSessionId}`);
      io.to(`booking_${data.bookingId}`).emit('call_declined', data);
      io.to(`user_${data.callerId}`).emit('call_declined', data);
    });

    socket.on('call_end', (data: { bookingId: string; callSessionId: string; endedBy: string }) => {
      console.log(`[Call] Call ended for session ${data.callSessionId} by ${data.endedBy}`);
      io.to(`booking_${data.bookingId}`).emit('call_ended', data);
    });

    // SOS Emergency Broadcast
    socket.on('sos_broadcast', (data: { bookingId: string; userId: string; lat: number; lng: number }) => {
      io.emit('emergency_sos_alert', data);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
}
