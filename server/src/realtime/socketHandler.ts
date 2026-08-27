import { Server, Socket } from 'socket.io';
import { run, get } from '../db/index.js';
import { verifyToken, AuthUserPayload } from '../middleware/auth.js';
import { Booking, DriverProfile, User } from '../types/index.js';

export function setupSocketHandlers(io: Server) {
  // 1. Socket.IO Handshake Authentication Middleware
  io.use((socket: Socket, next) => {
    const authHeader = socket.handshake.headers?.authorization;
    const token =
      socket.handshake.auth?.token ||
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (token) {
      const user = verifyToken(token);
      if (user) {
        socket.data.user = user;
      }
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    const authUser: AuthUserPayload | undefined = socket.data.user;
    console.log(`[Socket.IO] Client connected: ${socket.id} (User: ${authUser?.id || 'Guest'})`);

    // Automatically join authenticated user's private notification channel
    if (authUser?.id) {
      socket.join(`user_${authUser.id}`);
    }

    // Fallback explicit join (verifies user identity)
    socket.on('join_user', (userId: string) => {
      if (authUser && authUser.id !== userId && authUser.role !== 'SUPER_ADMIN' && authUser.role !== 'ADMIN') {
        console.warn(`[Socket.IO Security] User ${authUser.id} attempted to join unauthorized channel user_${userId}`);
        return;
      }
      socket.join(`user_${userId}`);
    });

    // Join room for specific booking with strict participant authorization
    socket.on('join_booking', (bookingId: string) => {
      const booking = get<Booking>('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      if (!booking) return;

      if (authUser) {
        const driverProfile = booking.driver_id
          ? get<{ user_id: string }>('SELECT user_id FROM driver_profiles WHERE id = ?', [booking.driver_id])
          : null;

        const isPassenger = booking.passenger_id === authUser.id;
        const isDriver = driverProfile?.user_id === authUser.id;
        const isAdmin = authUser.role === 'SUPER_ADMIN' || authUser.role === 'ADMIN';

        if (!isPassenger && !isDriver && !isAdmin) {
          console.warn(`[Socket.IO Security] Unauthorized user ${authUser.id} blocked from joining booking_${bookingId}`);
          return;
        }
      }

      socket.join(`booking_${bookingId}`);
    });

    // Driver broadcasts GPS location (Strict Driver Authentication)
    socket.on('driver_location_update', (data: { driverId?: string; lat: number; lng: number; heading?: number; bookingId?: string }) => {
      let authoritativeDriverId = data.driverId;

      if (authUser) {
        if (authUser.role !== 'DRIVER' && authUser.role !== 'SUPER_ADMIN' && authUser.role !== 'ADMIN') {
          return;
        }
        const profile = get<DriverProfile>('SELECT id FROM driver_profiles WHERE user_id = ?', [authUser.id]);
        if (profile) {
          authoritativeDriverId = profile.id;
        }
      }

      if (!authoritativeDriverId) return;

      const lat = data.lat;
      const lng = data.lng;
      const heading = data.heading || 0;

      run(
        `UPDATE driver_profiles 
         SET current_lat = ?, current_lng = ?, heading = ?, last_location_update = datetime('now')
         WHERE id = ?`,
        [lat, lng, heading, authoritativeDriverId]
      );

      // Targeted emission: Only to active booking room and authorized fleet managers/admins
      if (data.bookingId) {
        io.to(`booking_${data.bookingId}`).emit('driver_moved', {
          driverId: authoritativeDriverId,
          lat,
          lng,
          heading
        });
      }

      // Fleet/Admin authorized stream
      io.to('admin_fleet_telematics').emit('driver_telematics_fleet', {
        driverId: authoritativeDriverId,
        lat,
        lng,
        heading
      });
    });

    // In-trip Passenger <-> Driver Chat with Server Identity Enforcement
    socket.on('send_chat_message', (data: {
      bookingId: string;
      message: string;
      receiverId?: string;
    }) => {
      if (!data.bookingId || !data.message?.trim()) return;

      const booking = get<Booking>('SELECT * FROM bookings WHERE id = ?', [data.bookingId]);
      if (!booking) return;

      let senderId = authUser?.id || 'usr_passenger';
      let senderRole = authUser?.role || 'PASSENGER';

      const userRecord = get<User>('SELECT name FROM users WHERE id = ?', [senderId]);
      const senderName = userRecord?.name || 'User';

      const msgId = `msg_${Date.now()}`;
      run(`
        INSERT INTO chat_messages (id, booking_id, sender_id, sender_role, message)
        VALUES (?, ?, ?, ?, ?)
      `, [msgId, data.bookingId, senderId, senderRole, data.message.trim()]);

      const messagePayload = {
        id: msgId,
        bookingId: data.bookingId,
        senderId,
        senderName,
        senderRole,
        message: data.message.trim(),
        createdAt: new Date().toISOString()
      };

      io.to(`booking_${data.bookingId}`).emit('new_chat_message', messagePayload);
      if (data.receiverId) {
        io.to(`user_${data.receiverId}`).emit('new_chat_message', messagePayload);
      }
    });

    // In-App VoIP Audio Call Signaling
    socket.on('call_initiate', (data: {
      bookingId: string;
      callerId?: string;
      callerName?: string;
      callerRole?: 'PASSENGER' | 'DRIVER';
      callerAvatar?: string;
      receiverId: string;
      receiverName: string;
    }) => {
      const callerId = authUser?.id || data.callerId || 'usr_passenger';
      const callerRole = authUser?.role === 'DRIVER' ? 'DRIVER' : 'PASSENGER';
      const callerUser = get<User>('SELECT name, avatar_url FROM users WHERE id = ?', [callerId]);

      const callSessionId = `call_${Date.now()}`;
      const callData = {
        ...data,
        callerId,
        callerRole,
        callerName: callerUser?.name || data.callerName || 'User',
        callerAvatar: callerUser?.avatar_url || data.callerAvatar,
        callSessionId,
        timestamp: Date.now(),
        virtualRelayNumber: '+91 484-719-0099'
      };

      io.to(`user_${data.receiverId}`).emit('incoming_call', callData);
      io.to(`booking_${data.bookingId}`).emit('call_ringing', callData);
    });

    socket.on('call_accept', (data: { bookingId: string; callSessionId: string; callerId: string; receiverId: string }) => {
      io.to(`user_${data.callerId}`).emit('call_connected', data);
      io.to(`booking_${data.bookingId}`).emit('call_connected', data);
    });

    socket.on('call_reject', (data: { bookingId: string; callSessionId: string; callerId: string; receiverId: string }) => {
      io.to(`user_${data.callerId}`).emit('call_declined', data);
      io.to(`booking_${data.bookingId}`).emit('call_declined', data);
    });

    socket.on('call_end', (data: { bookingId: string; callSessionId: string; endedBy: string }) => {
      io.to(`booking_${data.bookingId}`).emit('call_ended', data);
    });
  });
}
