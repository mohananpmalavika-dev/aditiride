import { Server, Socket } from 'socket.io';
import { run, get } from '../db/index.js';
import { verifyToken, AuthUserPayload } from '../middleware/auth.js';
import { Booking, DriverProfile, User } from '../types/index.js';

export function setupSocketHandlers(io: Server) {
  // 1. Mandatory Socket.IO Handshake Authentication Middleware
  io.use((socket: Socket, next) => {
    const authHeader = socket.handshake.headers?.authorization;
    const token =
      socket.handshake.auth?.token ||
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (!token) {
      return next(new Error('AUTH_REQUIRED'));
    }

    const user = verifyToken(token);
    if (!user) {
      return next(new Error('INVALID_TOKEN'));
    }

    socket.data.user = user;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const authUser: AuthUserPayload = socket.data.user;
    if (!authUser) {
      socket.disconnect(true);
      return;
    }

    // Automatically join authenticated user's private notification room
    socket.join(`user_${authUser.id}`);

    // Join room for specific booking with strict participant authorization
    socket.on('join_booking', (bookingId: string) => {
      const booking = get<Booking>('SELECT * FROM bookings WHERE id = ?', [bookingId]);
      if (!booking) return;

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

      socket.join(`booking_${bookingId}`);
    });

    // Driver broadcasts GPS location (Strict Driver Profile Identity Resolution)
    socket.on('driver_location_update', (data: { lat: number; lng: number; heading?: number; bookingId?: string; speed?: number; accuracy?: number }) => {
      if (authUser.role !== 'DRIVER' && authUser.role !== 'SUPER_ADMIN' && authUser.role !== 'ADMIN') {
        return;
      }

      const profile = get<DriverProfile>('SELECT id FROM driver_profiles WHERE user_id = ?', [authUser.id]);
      if (!profile) return;

      const authoritativeDriverId = profile.id;
      const lat = data.lat;
      const lng = data.lng;
      const heading = data.heading || 0;

      // Validate geographic bounds
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return;
      }

      run(
        `UPDATE driver_profiles 
         SET current_lat = ?, current_lng = ?, heading = ?, last_location_update = datetime('now')
         WHERE id = ?`,
        [lat, lng, heading, authoritativeDriverId]
      );

      // Targeted emission: Only to active booking room and authorized fleet channel
      if (data.bookingId) {
        io.to(`booking_${data.bookingId}`).emit('driver_moved', {
          driverId: authoritativeDriverId,
          lat,
          lng,
          heading
        });
      }

      io.to('admin_fleet_telematics').emit('driver_telematics_fleet', {
        driverId: authoritativeDriverId,
        lat,
        lng,
        heading
      });
    });

    // Passenger broadcasts live GPS location during accepted / active ride (Mutual Sharing)
    socket.on('passenger_location_update', (data: { bookingId: string; lat: number; lng: number; heading?: number; accuracy?: number; speed?: number }) => {
      if (!data.bookingId || data.lat === undefined || data.lng === undefined) {
        return;
      }

      const booking = get<Booking>('SELECT * FROM bookings WHERE id = ?', [data.bookingId]);
      if (!booking) return;

      // Ensure authenticated user is the actual passenger of this booking
      if (booking.passenger_id !== authUser.id && authUser.role !== 'SUPER_ADMIN' && authUser.role !== 'ADMIN') {
        return;
      }

      // Mutual sharing only occurs while trip is active / accepted until ride ends
      const activeStatuses = ['DRIVER_ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'TRIP_STARTED', 'TRIP_IN_PROGRESS'];
      if (!activeStatuses.includes(booking.status)) {
        return;
      }

      const lat = data.lat;
      const lng = data.lng;
      const heading = data.heading || 0;
      const accuracy = data.accuracy || 10;

      // Validate geographic bounds
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return;
      }

      // Update pickup coordinates in booking if driver hasn't started trip yet
      if (['DRIVER_ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED'].includes(booking.status)) {
        run(`UPDATE bookings SET pickup_lat = ?, pickup_lng = ? WHERE id = ?`, [lat, lng, data.bookingId]);
      }

      const passengerPayload = {
        bookingId: data.bookingId,
        passengerId: authUser.id,
        passengerName: authUser.name || 'Passenger',
        lat,
        lng,
        heading,
        accuracy,
        speed: data.speed || 0,
        updatedAt: new Date().toISOString()
      };

      // Broadcast to booking room (received by Driver)
      io.to(`booking_${data.bookingId}`).emit('passenger_moved', passengerPayload);

      // If driver is assigned, also send directly to driver user room
      if (booking.driver_id) {
        const driverProfile = get<{ user_id: string }>('SELECT user_id FROM driver_profiles WHERE id = ?', [booking.driver_id]);
        if (driverProfile?.user_id) {
          io.to(`user_${driverProfile.user_id}`).emit('passenger_moved', passengerPayload);
        }
      }
    });

    // In-trip Passenger <-> Driver Chat with Strict Participant Authorization
    socket.on('send_chat_message', (data: { bookingId: string; message: string; receiverId?: string }) => {
      if (!data.bookingId || !data.message?.trim()) return;

      const booking = get<Booking>('SELECT * FROM bookings WHERE id = ?', [data.bookingId]);
      if (!booking) return;

      const driverProfile = booking.driver_id
        ? get<{ user_id: string }>('SELECT user_id FROM driver_profiles WHERE id = ?', [booking.driver_id])
        : null;

      const isPassenger = booking.passenger_id === authUser.id;
      const isDriver = driverProfile?.user_id === authUser.id;
      const isAdmin = authUser.role === 'SUPER_ADMIN' || authUser.role === 'ADMIN';

      if (!isPassenger && !isDriver && !isAdmin) {
        console.warn(`[Socket.IO Security] Unauthorized chat attempt on booking ${data.bookingId} by user ${authUser.id}`);
        return;
      }

      const senderId = authUser.id;
      const senderRole = authUser.role;
      const userRecord = get<User>('SELECT name FROM users WHERE id = ?', [senderId]);
      const senderName = userRecord?.name || authUser.name || 'User';

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

    // In-App VoIP Audio Call Signaling with Strict Participant Verification
    socket.on('call_initiate', (data: {
      bookingId: string;
      callerAvatar?: string;
      receiverId: string;
      receiverName: string;
    }) => {
      const booking = get<Booking>('SELECT * FROM bookings WHERE id = ?', [data.bookingId]);
      if (!booking) return;

      const driverProfile = booking.driver_id
        ? get<{ user_id: string }>('SELECT user_id FROM driver_profiles WHERE id = ?', [booking.driver_id])
        : null;

      const isPassenger = booking.passenger_id === authUser.id;
      const isDriver = driverProfile?.user_id === authUser.id;

      if (!isPassenger && !isDriver) {
        return;
      }

      const callerId = authUser.id;
      const callerRole = isDriver ? 'DRIVER' : 'PASSENGER';
      const userRecord = get<User>('SELECT name, avatar_url FROM users WHERE id = ?', [callerId]);
      const callerName = userRecord?.name || authUser.name || 'Caller';
      const callerAvatar = userRecord?.avatar_url || data.callerAvatar;

      const callSessionId = `call_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

      io.to(`user_${data.receiverId}`).emit('incoming_call', {
        callSessionId,
        bookingId: data.bookingId,
        callerId,
        callerName,
        callerRole,
        callerAvatar,
        receiverId: data.receiverId,
        receiverName: data.receiverName,
        createdAt: new Date().toISOString()
      });
    });

    socket.on('call_answer', (data: { callSessionId: string; bookingId: string; callerId: string }) => {
      io.to(`user_${data.callerId}`).emit('call_connected', {
        callSessionId: data.callSessionId,
        bookingId: data.bookingId,
        answeredBy: authUser.id
      });
    });

    socket.on('call_reject', (data: { callSessionId: string; callerId: string; reason?: string }) => {
      io.to(`user_${data.callerId}`).emit('call_declined', {
        callSessionId: data.callSessionId,
        rejectedBy: authUser.id,
        reason: data.reason || 'User busy'
      });
    });

    socket.on('call_end', (data: { callSessionId: string; peerUserId: string }) => {
      io.to(`user_${data.peerUserId}`).emit('call_ended', {
        callSessionId: data.callSessionId,
        endedBy: authUser.id
      });
    });
  });
}
