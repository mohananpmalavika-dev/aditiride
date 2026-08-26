import { Server, Socket } from 'socket.io';
import { run, get } from '../db/index.js';
import { DriverProfile } from '../types/index.js';

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Join room for specific booking
    socket.on('join_booking', (bookingId: string) => {
      socket.join(`booking_${bookingId}`);
      console.log(`[Socket.IO] ${socket.id} joined room booking_${bookingId}`);
    });

    // Driver broadcasts real-time GPS location
    socket.on('driver_location_update', (data: { driverId: string; lat: number; lng: number; heading: number; bookingId?: string }) => {
      const { driverId, lat, lng, heading, bookingId } = data;
      
      // Update driver position in database
      run(
        `UPDATE driver_profiles 
         SET current_lat = ?, current_lng = ?, heading = ?, last_location_update = datetime('now')
         WHERE id = ?`,
        [lat, lng, heading || 0, driverId]
      );

      // Broadcast to any active passenger tracking this driver or booking
      if (bookingId) {
        io.to(`booking_${bookingId}`).emit('driver_moved', { driverId, lat, lng, heading });
      }

      // Broadcast globally for Admin Live Control Room
      io.emit('driver_telematics_global', { driverId, lat, lng, heading });
    });

    // Booking state changed notification
    socket.on('booking_state_updated', (data: { bookingId: string; status: string; booking: any }) => {
      io.to(`booking_${data.bookingId}`).emit('booking_status_changed', data);
      io.emit('admin_booking_updated', data);
    });

    // In-trip Passenger <-> Driver chat
    socket.on('send_chat_message', (data: { bookingId: string; senderId: string; senderRole: string; message: string }) => {
      const msgId = `msg_${Date.now()}`;
      run(`
        INSERT INTO chat_messages (id, booking_id, sender_id, sender_role, message)
        VALUES (?, ?, ?, ?, ?)
      `, [msgId, data.bookingId, data.senderId, data.senderRole, data.message]);

      io.to(`booking_${data.bookingId}`).emit('new_chat_message', {
        id: msgId,
        ...data,
        createdAt: new Date().toISOString()
      });
    });

    // SOS Emergency broadcast
    socket.on('sos_broadcast', (data: { bookingId: string; userId: string; lat: number; lng: number }) => {
      io.emit('emergency_sos_alert', data);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
}
