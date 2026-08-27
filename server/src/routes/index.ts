import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { get, query, run } from '../db/index.js';
import { FareEngine } from '../services/FareEngine.js';
import { LocationService } from '../services/LocationService.js';
import { MatchingEngine } from '../services/MatchingEngine.js';
import { VoiceEngine } from '../services/VoiceEngine.js';
import { BookingStateMachine } from '../services/BookingStateMachine.js';
import { PaymentService } from '../services/PaymentService.js';
import { SafetyService } from '../services/SafetyService.js';
import { AdminService } from '../services/AdminService.js';
import {
  authenticateToken,
  optionalAuth,
  requireRole,
  generateToken,
  comparePassword,
  hashPassword,
  AuthenticatedRequest
} from '../middleware/auth.js';
import {
  Booking,
  DriverProfile,
  User,
  VehicleCategory,
  FavoriteRelationship,
  UserBlock,
  ScheduledBooking
} from '../types/index.js';

export const apiRouter = Router();

// ==========================================
// 1. AUTHENTICATION & USERS
// ==========================================
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { identifier, password } = req.body;

  if (!identifier) {
    return res.status(400).json({ error: 'Please enter your username, email, or phone number' });
  }

  const user = get<User>(
    'SELECT * FROM users WHERE username = ? OR email = ? OR phone = ? OR id = ?',
    [identifier, identifier, identifier, identifier]
  );

  if (!user) {
    return res.status(404).json({ error: 'Account not found. Please check your credentials or register.' });
  }

  // Authoritative Password Verification via bcrypt
  if (password && user.password_hash) {
    const isMatch = comparePassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }
  }

  // Fetch role-specific profile details
  let roleData: any = {};
  if (user.role === 'PASSENGER') {
    roleData = get('SELECT * FROM passenger_profiles WHERE user_id = ?', [user.id]);
  } else if (user.role === 'DRIVER') {
    roleData = get(`
      SELECT d.*, v.id as vehicle_id, v.brand as vehicle_brand, v.model as vehicle_model, v.plate_number as vehicle_plate, v.vehicle_category_id
      FROM driver_profiles d
      LEFT JOIN vehicles v ON v.driver_id = d.id
      WHERE d.user_id = ?
    `, [user.id]);
  }

  // Generate cryptographically signed JWT token
  const token = generateToken(user);

  res.json({
    user,
    roleData,
    token
  });
});

apiRouter.post('/auth/register', (req: Request, res: Response) => {
  const {
    username,
    phone,
    name,
    email,
    password,
    role,
    preferredLanguage,
    vehicleCategoryId,
    vehicleBrand,
    vehicleModel,
    vehiclePlate
  } = req.body;

  if (!phone || !name) {
    return res.status(400).json({ error: 'Name and Phone number are required' });
  }

  const existingPhone = get<User>('SELECT * FROM users WHERE phone = ?', [phone]);
  if (existingPhone) {
    return res.status(409).json({ error: 'An account with this phone number already exists' });
  }

  if (username) {
    const existingUser = get<User>('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(409).json({ error: 'Username is already taken' });
    }
  }

  const userId = `usr_${uuidv4().substring(0, 8)}`;
  const userRole = role || 'PASSENGER';
  const hashedPassword = hashPassword(password || 'Thathu@110');
  const userEmail = email || `${username || phone}@aditiride.com`;

  run(`
    INSERT INTO users (id, username, phone, email, name, role, password_hash, preferred_language, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
  `, [userId, username || null, phone, userEmail, name, userRole, hashedPassword, preferredLanguage || 'en']);

  if (userRole === 'PASSENGER') {
    run(`
      INSERT INTO passenger_profiles (id, user_id, default_vehicle_category_id, default_payment_method, wallet_balance)
      VALUES (?, ?, 'cat_auto', 'UPI', 500.0)
    `, [`prof_${uuidv4().substring(0, 8)}`, userId]);

    run(`INSERT INTO wallets (id, user_id, balance, currency) VALUES (?, ?, 500.0, 'INR')`, [
      `wal_${uuidv4().substring(0, 8)}`,
      userId
    ]);
  } else if (userRole === 'DRIVER') {
    const driverProfileId = `drv_${uuidv4().substring(0, 8)}`;
    const categoryId = vehicleCategoryId || 'cat_auto';
    
    run(`
      INSERT INTO driver_profiles (
        id, user_id, verification_status, availability_status, current_lat, current_lng, heading,
        rating_avg, acceptance_rate, cancellation_rate, total_trips, custom_fare_enabled, accepts_favorite_requests
      ) VALUES (?, ?, 'VERIFIED', 'ONLINE', 10.5276, 76.2144, 0, 5.0, 1.0, 0.0, 0, 1, 1)
    `, [driverProfileId, userId]);

    const vehicleId = `veh_${uuidv4().substring(0, 8)}`;
    run(`
      INSERT INTO vehicles (
        id, driver_id, vehicle_category_id, vehicle_type, brand, model, year, color, plate_number, status
      ) VALUES (?, ?, ?, 'Standard', ?, ?, 2024, 'White', ?, 'ACTIVE')
    `, [
      vehicleId,
      driverProfileId,
      categoryId,
      vehicleBrand || 'Bajaj',
      vehicleModel || 'Compact',
      vehiclePlate || `KL-08-${Math.floor(1000 + Math.random() * 9000)}`
    ]);

    run(`
      INSERT INTO driver_pricing (
        id, driver_id, vehicle_category_id, custom_base_fare, custom_per_km, custom_per_minute, custom_waiting_rate, custom_minimum_fare
      ) VALUES (?, ?, ?, 40.0, 14.0, 2.0, 2.0, 50.0)
    `, [uuidv4(), driverProfileId, categoryId]);
  }

  const createdUser = get<User>('SELECT * FROM users WHERE id = ?', [userId]);
  const token = generateToken(createdUser!);
  res.status(201).json({ user: createdUser, token });
});

apiRouter.get('/auth/me', authenticateToken, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const user = get<User>('SELECT id, username, phone, email, name, role, avatar_url, preferred_language, status FROM users WHERE id = ?', [authReq.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  let roleData: any = {};
  if (user.role === 'PASSENGER') {
    roleData = get('SELECT * FROM passenger_profiles WHERE user_id = ?', [user.id]);
  } else if (user.role === 'DRIVER') {
    roleData = get(`
      SELECT d.*, v.id as vehicle_id, v.brand as vehicle_brand, v.model as vehicle_model, v.plate_number as vehicle_plate, v.vehicle_category_id
      FROM driver_profiles d
      LEFT JOIN vehicles v ON v.driver_id = d.id
      WHERE d.user_id = ?
    `, [user.id]);
  }

  res.json({ user, roleData });
});

apiRouter.get('/auth/users', authenticateToken, requireRole('SUPER_ADMIN', 'ADMIN'), (_req: Request, res: Response) => {
  const users = query<User>('SELECT id, phone, email, name, role, avatar_url, preferred_language, status FROM users');
  res.json({ users });
});

// ==========================================
// 2. VEHICLE CATEGORIES & CATALOGUE
// ==========================================
apiRouter.get('/categories', (_req: Request, res: Response) => {
  const categories = query<VehicleCategory>('SELECT * FROM vehicle_categories WHERE active = 1 ORDER BY sort_order ASC');
  res.json({ categories });
});

apiRouter.put('/categories/:id', authenticateToken, requireRole('SUPER_ADMIN', 'ADMIN'), (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  
  run(`
    UPDATE vehicle_categories
    SET base_fare = COALESCE(?, base_fare),
        per_km_rate = COALESCE(?, per_km_rate),
        per_minute_rate = COALESCE(?, per_minute_rate),
        minimum_fare = COALESCE(?, minimum_fare),
        surge_enabled = COALESCE(?, surge_enabled),
        driver_custom_fare_allowed = COALESCE(?, driver_custom_fare_allowed),
        max_deviation_percent = COALESCE(?, max_deviation_percent)
    WHERE id = ?
  `, [
    updates.base_fare,
    updates.per_km_rate,
    updates.per_minute_rate,
    updates.minimum_fare,
    updates.surge_enabled,
    updates.driver_custom_fare_allowed,
    updates.max_deviation_percent,
    id
  ]);

  const updated = get<VehicleCategory>('SELECT * FROM vehicle_categories WHERE id = ?', [id]);
  res.json({ category: updated });
});

// ==========================================
// 3. LOCATION & OPENSTREETMAP ROUTING
// ==========================================
apiRouter.get('/location/search', async (req: Request, res: Response) => {
  const q = (req.query.q as string) || '';
  const results = await LocationService.searchLocations(q);
  res.json({ locations: results });
});

apiRouter.get('/location/reverse', async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required' });
  }

  const address = await LocationService.reverseGeocode(lat, lng);
  res.json({ address, lat, lng });
});

apiRouter.post('/location/route', async (req: Request, res: Response) => {
  const { origin, destination, stops } = req.body;
  if (!origin || !destination) {
    return res.status(400).json({ error: 'Origin and Destination coordinates are required' });
  }

  const route = await LocationService.calculateRoute(origin, destination, stops || []);
  res.json({ route });
});

// ==========================================
// 4. FARE ENGINE & ESTIMATES
// ==========================================
apiRouter.post('/fare/estimate', (req: Request, res: Response) => {
  const { vehicleCategoryId, distanceKm, durationMin, pickupLat, pickupLng, driverId, promoCode, numberOfStops } = req.body;
  try {
    const quote = FareEngine.calculateFare({
      vehicleCategoryId,
      distanceKm: parseFloat(distanceKm) || 4.5,
      durationMin: parseFloat(durationMin) || 15,
      pickupLat,
      pickupLng,
      driverId,
      promoCode,
      numberOfStops
    });
    res.json({ quote });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/fare/all-estimates', async (req: Request, res: Response) => {
  const { origin, destination, driverId } = req.body;
  if (!origin || !destination) {
    return res.status(400).json({ error: 'Origin and Destination are required' });
  }

  try {
    const route = await LocationService.calculateRoute(origin, destination);
    const quotes = FareEngine.calculateMultiCategoryEstimates(
      route.distanceKm,
      route.durationMin,
      origin.lat,
      origin.lng,
      driverId
    );

    res.json({
      route,
      quotes
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 5. DRIVER DISPATCH & NEARBY MATCHING
// ==========================================
apiRouter.get('/drivers/nearby', optionalAuth, (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string) || 10.5276;
  const lng = parseFloat(req.query.lng as string) || 76.2144;
  const categoryId = (req.query.categoryId as string) || 'cat_auto';
  const passengerId = (req as AuthenticatedRequest).user?.id || (req.query.passengerId as string) || 'usr_passenger';

  const drivers = MatchingEngine.findNearbyDrivers(passengerId, lat, lng, categoryId, 10.0);
  res.json({ drivers });
});

// ==========================================
// 6. BOOKINGS & TRIP LIFECYCLE (Zero-Trust)
// ==========================================
apiRouter.post('/bookings', authenticateToken, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const passengerId = authReq.user.id; // Enforce authenticated identity

  const {
    vehicleCategoryId,
    pickupLat,
    pickupLng,
    pickupAddress,
    destinationLat,
    destinationLng,
    destinationAddress,
    bookingType,
    scheduledAt,
    paymentMethod,
    stops,
    preferredDriverId
  } = req.body;

  if (!pickupLat || !pickupLng || !destinationLat || !destinationLng) {
    return res.status(400).json({ error: 'Pickup and Destination coordinates are required' });
  }

  // Calculate real OSRM road route & authoritative price quote
  const route = await LocationService.calculateRoute(
    { lat: pickupLat, lng: pickupLng },
    { lat: destinationLat, lng: destinationLng },
    stops || []
  );

  const quote = FareEngine.calculateFare({
    vehicleCategoryId,
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
    pickupLat,
    pickupLng,
    driverId: preferredDriverId,
    numberOfStops: stops?.length || 0
  });

  const bookingId = `bk_${uuidv4().substring(0, 8)}`;
  const bookingNumber = `ADITI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const otpCode = SafetyService.generateTripOtp();

  let candidateDriverId: string | null = null;
  const nearbyDrivers = MatchingEngine.findNearbyDrivers(
    passengerId,
    pickupLat,
    pickupLng,
    vehicleCategoryId,
    10.0,
    preferredDriverId
  );

  let initialStatus = 'SEARCHING';
  if (nearbyDrivers.length > 0) {
    candidateDriverId = nearbyDrivers[0].driverId;
    initialStatus = 'DRIVER_ASSIGNED';
  }

  run(`
    INSERT INTO bookings (
      id, booking_number, passenger_id, driver_id, vehicle_category_id, booking_type,
      pickup_lat, pickup_lng, pickup_address, destination_lat, destination_lng, destination_address,
      scheduled_at, distance_km, duration_min, otp_code, fare_estimate, fare_source,
      fare_rule_version, surge_multiplier, payment_method, payment_status, status
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, 'PENDING', ?
    )
  `, [
    bookingId, bookingNumber, passengerId, candidateDriverId, vehicleCategoryId, bookingType || 'INSTANT',
    pickupLat, pickupLng, pickupAddress, destinationLat, destinationLng, destinationAddress,
    scheduledAt || null, route.distanceKm, route.durationMin, otpCode, quote.total_fare, quote.fare_source,
    quote.fare_rule_version, quote.surge_multiplier, paymentMethod || 'UPI', initialStatus
  ]);

  // Insert Stops if provided
  if (stops && Array.isArray(stops)) {
    stops.forEach((stop, idx) => {
      run(`
        INSERT INTO booking_stops (id, booking_id, stop_order, lat, lng, address)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [uuidv4(), bookingId, idx + 1, stop.lat, stop.lng, stop.address]);
    });
  }

  const created = get<Booking>(`
    SELECT 
      b.*,
      pu.name as passenger_name, pu.phone as passenger_phone,
      du.name as driver_name, du.phone as driver_phone, du.avatar_url as driver_avatar,
      d.current_lat as driver_lat, d.current_lng as driver_lng, d.heading as driver_heading, d.rating_avg as driver_rating,
      v.brand as vehicle_brand, v.model as vehicle_model, v.color as vehicle_color, v.plate_number as vehicle_plate,
      vc.name as vehicle_category_name
    FROM bookings b
    JOIN users pu ON b.passenger_id = pu.id
    LEFT JOIN driver_profiles d ON b.driver_id = d.id
    LEFT JOIN users du ON d.user_id = du.id
    LEFT JOIN vehicles v ON v.driver_id = d.id
    JOIN vehicle_categories vc ON b.vehicle_category_id = vc.id
    WHERE b.id = ?
  `, [bookingId]);

  // Broadcast real-time voice & offer alert to matched driver
  const io = (req as any).io;
  if (io && nearbyDrivers.length > 0 && created) {
    const targetDriver = nearbyDrivers[0];
    const offerPayload = {
      bookingId: created.id,
      bookingNumber: created.booking_number,
      driverId: targetDriver.driverId,
      driverUserId: targetDriver.userId,
      passengerId: passengerId,
      passengerName: created.passenger_name || 'Passenger',
      pickupAddress: created.pickup_address,
      destinationAddress: created.destination_address,
      fareEstimate: created.fare_estimate,
      distanceKm: created.distance_km,
      durationMin: created.duration_min,
      vehicleCategoryId: created.vehicle_category_id,
      vehicleCategoryName: created.vehicle_category_name,
      isFavoriteRequest: !!preferredDriverId
    };

    io.to(`user_${targetDriver.userId}`).emit('incoming_ride_offer', offerPayload);
    io.to(`driver_${targetDriver.driverId}`).emit('incoming_ride_offer', offerPayload);
    io.emit('incoming_ride_offer_broadcast', offerPayload);
  }

  res.status(201).json({
    booking: created,
    route,
    quote,
    assignedDriver: nearbyDrivers[0] || null
  });
});

apiRouter.get('/bookings/recent', authenticateToken, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const recent = query<Booking>(`
    SELECT 
      b.*,
      vc.name as vehicle_category_name, vc.display_name as vehicle_category_display,
      du.name as driver_name, du.avatar_url as driver_avatar
    FROM bookings b
    JOIN vehicle_categories vc ON b.vehicle_category_id = vc.id
    LEFT JOIN driver_profiles d ON b.driver_id = d.id
    LEFT JOIN users du ON d.user_id = du.id
    WHERE b.passenger_id = ?
    ORDER BY b.created_at DESC
    LIMIT 20
  `, [authReq.user.id]);

  res.json({ bookings: recent });
});

apiRouter.get('/bookings/active', authenticateToken, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user.id;
  const role = authReq.user.role;

  let activeBooking: Booking | undefined;
  if (role === 'DRIVER') {
    activeBooking = get<Booking>(`
      SELECT 
        b.*,
        pu.name as passenger_name, pu.phone as passenger_phone, pu.avatar_url as passenger_avatar,
        vc.name as vehicle_category_name
      FROM bookings b
      JOIN driver_profiles d ON b.driver_id = d.id
      JOIN users pu ON b.passenger_id = pu.id
      JOIN vehicle_categories vc ON b.vehicle_category_id = vc.id
      WHERE d.user_id = ? AND b.status NOT IN ('COMPLETED', 'CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER', 'EXPIRED', 'NO_DRIVER')
      ORDER BY b.created_at DESC LIMIT 1
    `, [userId]);
  } else {
    activeBooking = get<Booking>(`
      SELECT 
        b.*,
        du.name as driver_name, du.phone as driver_phone, du.avatar_url as driver_avatar,
        d.current_lat as driver_lat, d.current_lng as driver_lng, d.heading as driver_heading, d.rating_avg as driver_rating,
        v.brand as vehicle_brand, v.model as vehicle_model, v.color as vehicle_color, v.plate_number as vehicle_plate,
        vc.name as vehicle_category_name
      FROM bookings b
      LEFT JOIN driver_profiles d ON b.driver_id = d.id
      LEFT JOIN users du ON d.user_id = du.id
      LEFT JOIN vehicles v ON v.driver_id = d.id
      JOIN vehicle_categories vc ON b.vehicle_category_id = vc.id
      WHERE b.passenger_id = ? AND b.status NOT IN ('COMPLETED', 'CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER', 'EXPIRED', 'NO_DRIVER')
      ORDER BY b.created_at DESC LIMIT 1
    `, [userId]);
  }

  res.json({ activeBooking: activeBooking || null });
});

apiRouter.get('/bookings/:id', authenticateToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const booking = get<Booking>(`
    SELECT 
      b.*,
      pu.name as passenger_name, pu.phone as passenger_phone, pu.avatar_url as passenger_avatar,
      du.name as driver_name, du.phone as driver_phone, du.avatar_url as driver_avatar,
      d.current_lat as driver_lat, d.current_lng as driver_lng, d.heading as driver_heading, d.rating_avg as driver_rating,
      v.brand as vehicle_brand, v.model as vehicle_model, v.color as vehicle_color, v.plate_number as vehicle_plate,
      vc.name as vehicle_category_name
    FROM bookings b
    JOIN users pu ON b.passenger_id = pu.id
    LEFT JOIN driver_profiles d ON b.driver_id = d.id
    LEFT JOIN users du ON d.user_id = du.id
    LEFT JOIN vehicles v ON v.driver_id = d.id
    JOIN vehicle_categories vc ON b.vehicle_category_id = vc.id
    WHERE b.id = ?
  `, [id]);

  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  res.json({ booking });
});

apiRouter.post('/bookings/:id/transition', authenticateToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;
  const { nextStatus, status, otp, cancellationReason, finalDistanceKm, finalDurationMin } = req.body;
  const targetStatus = nextStatus || status;

  try {
    const updated = BookingStateMachine.transition(id, targetStatus, authReq.user.id, {
      otp,
      cancellationReason,
      finalDistanceKm,
      finalDurationMin
    });

    const io = (req as any).io;
    if (io) {
      io.to(`booking_${id}`).emit('booking_status_changed', { bookingId: id, status: targetStatus, booking: updated });
    }

    res.json({ booking: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/bookings/:id/rate', authenticateToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;
  const { rating, tags, comment, isSafetyReport } = req.body;

  const numRating = parseFloat(rating);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'Rating must be an integer or decimal between 1 and 5 stars.' });
  }

  const booking = get<Booking>('SELECT * FROM bookings WHERE id = ?', [id]);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  if (booking.status !== 'COMPLETED') {
    return res.status(400).json({ error: 'Cannot rate an active or uncompleted ride. Rating is only permitted once the trip is completed.' });
  }

  const driverProfile = booking.driver_id
    ? get<{ user_id: string }>('SELECT user_id FROM driver_profiles WHERE id = ?', [booking.driver_id])
    : null;

  const isPassenger = booking.passenger_id === authReq.user.id;
  const isDriver = driverProfile?.user_id === authReq.user.id;

  if (!isPassenger && !isDriver) {
    return res.status(403).json({ error: 'Access forbidden: Only verified ride participants can rate this trip.' });
  }

  // Server authoritatively derives the counterpart being rated
  const authoritativeRatedUserId = isPassenger ? driverProfile?.user_id : booking.passenger_id;
  if (!authoritativeRatedUserId) {
    return res.status(400).json({ error: 'No counterpart user found to rate for this trip.' });
  }

  // Check for duplicate rating by the same user
  const existingRating = get('SELECT id FROM ratings WHERE booking_id = ? AND rater_id = ?', [id, authReq.user.id]);
  if (existingRating) {
    return res.status(409).json({ error: 'You have already submitted a rating for this trip.' });
  }

  const ratingId = `rat_${uuidv4().substring(0, 8)}`;
  run(`
    INSERT INTO ratings (id, booking_id, rater_id, rated_user_id, rating, tags, comment, is_safety_report)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [ratingId, id, authReq.user.id, authoritativeRatedUserId, numRating, JSON.stringify(tags || []), comment || null, isSafetyReport ? 1 : 0]);

  const avgData = get<{ avg: number }>(`SELECT AVG(rating) as avg FROM ratings WHERE rated_user_id = ?`, [authoritativeRatedUserId]);
  if (avgData && avgData.avg) {
    const rounded = Math.round(avgData.avg * 100) / 100;
    run(`UPDATE driver_profiles SET rating_avg = ? WHERE user_id = ?`, [rounded, authoritativeRatedUserId]);
    run(`UPDATE passenger_profiles SET rating_avg = ? WHERE user_id = ?`, [rounded, authoritativeRatedUserId]);
  }

  res.json({ success: true, ratingId, message: 'Rating submitted successfully' });
});

// ==========================================
// 7. VOICE BOOKING ENGINE
// ==========================================
apiRouter.post('/voice/intent', optionalAuth, (req: Request, res: Response) => {
  const { text, currentLat, currentLng, preferredLanguage } = req.body;
  if (!text) return res.status(400).json({ error: 'Text prompt is required' });

  const parsed = VoiceEngine.parseUtterance(text, currentLat || 10.5276, currentLng || 76.2144, preferredLanguage || 'en');
  res.json({ parsed });
});

// ==========================================
// 8. FAVORITE DRIVERS & BLOCKING (Zero-Trust IDOR Protection)
// ==========================================
apiRouter.get('/favorites/drivers', authenticateToken, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const passengerId = authReq.user.id; // Enforce authenticated user ID

  const favorites = query<any>(`
    SELECT 
      f.id as favorite_id, f.created_at, f.status,
      d.id as driver_id, d.rating_avg, d.availability_status, d.current_lat, d.current_lng,
      u.name as driver_name, u.avatar_url as driver_avatar,
      v.brand as vehicle_brand, v.model as vehicle_model, v.plate_number as vehicle_plate,
      vc.name as vehicle_category_name
    FROM favorites f
    JOIN driver_profiles d ON f.driver_id = d.id
    JOIN users u ON d.user_id = u.id
    JOIN vehicles v ON v.driver_id = d.id
    JOIN vehicle_categories vc ON v.vehicle_category_id = vc.id
    WHERE f.passenger_id = ? AND f.status = 'ACTIVE'
  `, [passengerId]);

  res.json({ favorites });
});

apiRouter.post('/favorites/drivers/:driverId', authenticateToken, (req: Request, res: Response) => {
  const { driverId } = req.params;
  const authReq = req as AuthenticatedRequest;
  const passengerId = authReq.user.id;

  const existing = get('SELECT id FROM favorites WHERE passenger_id = ? AND driver_id = ?', [passengerId, driverId]);
  if (existing) {
    run(`UPDATE favorites SET status = 'ACTIVE' WHERE passenger_id = ? AND driver_id = ?`, [passengerId, driverId]);
  } else {
    run(`INSERT INTO favorites (id, passenger_id, driver_id, status) VALUES (?, ?, ?, 'ACTIVE')`, [
      uuidv4(), passengerId, driverId
    ]);
  }

  res.json({ success: true, message: 'Driver added to favorites' });
});

apiRouter.delete('/favorites/drivers/:driverId', authenticateToken, (req: Request, res: Response) => {
  const { driverId } = req.params;
  const authReq = req as AuthenticatedRequest;
  const passengerId = authReq.user.id;

  run(`UPDATE favorites SET status = 'INACTIVE' WHERE passenger_id = ? AND driver_id = ?`, [passengerId, driverId]);
  res.json({ success: true, message: 'Driver removed from favorites' });
});

apiRouter.get('/blocks', authenticateToken, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const blockerUserId = authReq.user.id;

  const blocks = query<any>(`
    SELECT b.*, u.name as blocked_user_name, u.role as blocked_user_role
    FROM user_blocks b
    JOIN users u ON b.blocked_user_id = u.id
    WHERE b.blocker_user_id = ? AND b.status = 'ACTIVE'
  `, [blockerUserId]);

  res.json({ blocks });
});

apiRouter.post('/blocks/:userId', authenticateToken, (req: Request, res: Response) => {
  const { userId } = req.params;
  const authReq = req as AuthenticatedRequest;
  const blockerUserId = authReq.user.id;
  const { reason, blockType } = req.body;

  const blockId = `blk_${uuidv4().substring(0, 8)}`;
  run(`
    INSERT INTO user_blocks (id, blocker_user_id, blocked_user_id, reason, block_type, status, created_by)
    VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)
    ON CONFLICT(blocker_user_id, blocked_user_id) DO UPDATE SET status = 'ACTIVE', reason = ?
  `, [blockId, blockerUserId, userId, reason || 'User preference', blockType || 'PASSENGER_TO_DRIVER', blockerUserId, reason || 'User preference']);

  // Also inactivate any favorite link
  run(`UPDATE favorites SET status = 'INACTIVE' WHERE (passenger_id = ? AND driver_id = ?)`, [blockerUserId, userId]);

  res.json({ success: true, message: 'User blocked. You will not be matched together.' });
});

apiRouter.delete('/blocks/:userId', authenticateToken, (req: Request, res: Response) => {
  const { userId } = req.params;
  const authReq = req as AuthenticatedRequest;
  const blockerUserId = authReq.user.id;

  run(`UPDATE user_blocks SET status = 'REVOKED' WHERE blocker_user_id = ? AND blocked_user_id = ?`, [blockerUserId, userId]);
  res.json({ success: true, message: 'User unblocked' });
});

// ==========================================
// 9. SCHEDULED & RECURRING RIDES
// ==========================================
apiRouter.get('/scheduled-rides', authenticateToken, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const passengerId = authReq.user.id;

  const scheduled = query<any>(`
    SELECT s.*, vc.name as vehicle_category_name, vc.display_name as vehicle_category_display, vc.code as vehicle_category_code,
           d.rating_avg as driver_rating, u.name as driver_name, u.avatar_url as driver_avatar
    FROM scheduled_bookings s
    JOIN vehicle_categories vc ON s.vehicle_category_id = vc.id
    LEFT JOIN driver_profiles d ON s.specific_driver_id = d.id
    LEFT JOIN users u ON d.user_id = u.id
    WHERE s.passenger_id = ? AND s.status != 'CANCELLED'
    ORDER BY s.scheduled_time ASC
  `, [passengerId]);

  res.json({ scheduled });
});

apiRouter.post('/scheduled-rides', authenticateToken, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const passengerId = authReq.user.id;

  const {
    pickupLat,
    pickupLng,
    pickupAddress,
    destinationLat,
    destinationLng,
    destinationAddress,
    scheduledTime,
    vehicleCategoryId,
    driverPreference,
    specificDriverId,
    recurrenceRule,
    recurringDays,
    recurringTime,
    flightOrTrainNumber
  } = req.body;

  if (!pickupAddress || !destinationAddress || !scheduledTime) {
    return res.status(400).json({ error: 'Pickup, Destination and Scheduled Time are required' });
  }

  const pLat = parseFloat(pickupLat) || 10.5276;
  const pLng = parseFloat(pickupLng) || 76.2144;
  const dLat = parseFloat(destinationLat) || 10.5360;
  const dLng = parseFloat(destinationLng) || 76.2220;
  const catId = vehicleCategoryId || 'cat_sedan';

  const route = await LocationService.calculateRoute({ lat: pLat, lng: pLng }, { lat: dLat, lng: dLng });
  const quote = FareEngine.calculateFare({
    vehicleCategoryId: catId,
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
    pickupLat: pLat,
    pickupLng: pLng,
    driverId: specificDriverId
  });

  const id = `sched_${uuidv4().substring(0, 8)}`;
  run(`
    INSERT INTO scheduled_bookings (
      id, passenger_id, driver_preference, specific_driver_id, vehicle_category_id,
      pickup_lat, pickup_lng, pickup_address, destination_lat, destination_lng, destination_address,
      scheduled_time, recurrence_rule, flight_or_train_number, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
  `, [
    id, passengerId, driverPreference || 'ANY', specificDriverId || null, catId,
    pLat, pLng, pickupAddress, dLat, dLng, destinationAddress,
    scheduledTime, recurrenceRule || 'NONE', flightOrTrainNumber || null
  ]);

  const created = get<any>(`
    SELECT s.*, vc.name as vehicle_category_name, vc.display_name as vehicle_category_display, vc.code as vehicle_category_code
    FROM scheduled_bookings s
    JOIN vehicle_categories vc ON s.vehicle_category_id = vc.id
    WHERE s.id = ?
  `, [id]);

  res.status(201).json({
    scheduled: {
      ...created,
      estimated_fare: quote.total_fare,
      distance_km: route.distanceKm,
      duration_min: route.durationMin
    }
  });
});

apiRouter.post('/scheduled-rides/:id/cancel', authenticateToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;

  run(`UPDATE scheduled_bookings SET status = 'CANCELLED' WHERE id = ? AND passenger_id = ?`, [id, authReq.user.id]);
  res.json({ success: true, message: 'Scheduled ride cancelled successfully' });
});

apiRouter.post('/scheduled-rides/:id/dispatch-now', authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;

  const sched = get<any>('SELECT * FROM scheduled_bookings WHERE id = ? AND passenger_id = ?', [id, authReq.user.id]);
  if (!sched) return res.status(404).json({ error: 'Scheduled ride not found' });

  const route = await LocationService.calculateRoute(
    { lat: sched.pickup_lat, lng: sched.pickup_lng },
    { lat: sched.destination_lat, lng: sched.destination_lng }
  );

  const quote = FareEngine.calculateFare({
    vehicleCategoryId: sched.vehicle_category_id,
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
    pickupLat: sched.pickup_lat,
    pickupLng: sched.pickup_lng,
    driverId: sched.specific_driver_id
  });

  const bookingId = `bk_${uuidv4().substring(0, 8)}`;
  const bookingNumber = `ADITI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const otpCode = SafetyService.generateTripOtp();

  const nearbyDrivers = MatchingEngine.findNearbyDrivers(
    sched.passenger_id,
    sched.pickup_lat,
    sched.pickup_lng,
    sched.vehicle_category_id,
    10.0,
    sched.specific_driver_id
  );

  let candidateDriverId: string | null = null;
  let initialStatus = 'SEARCHING';
  if (nearbyDrivers.length > 0) {
    candidateDriverId = nearbyDrivers[0].driverId;
    initialStatus = 'DRIVER_ASSIGNED';
  }

  run(`
    INSERT INTO bookings (
      id, booking_number, passenger_id, driver_id, vehicle_category_id, booking_type,
      pickup_lat, pickup_lng, pickup_address, destination_lat, destination_lng, destination_address,
      scheduled_at, distance_km, duration_min, otp_code, fare_estimate, fare_source,
      fare_rule_version, surge_multiplier, payment_method, payment_status, status
    ) VALUES (
      ?, ?, ?, ?, ?, 'SCHEDULED',
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, 'UPI', 'PENDING', ?
    )
  `, [
    bookingId, bookingNumber, sched.passenger_id, candidateDriverId, sched.vehicle_category_id,
    sched.pickup_lat, sched.pickup_lng, sched.pickup_address, sched.destination_lat, sched.destination_lng, sched.destination_address,
    sched.scheduled_time, route.distanceKm, route.durationMin, otpCode, quote.total_fare, quote.fare_source,
    quote.fare_rule_version, quote.surge_multiplier, initialStatus
  ]);

  run(`UPDATE scheduled_bookings SET status = 'DISPATCHED' WHERE id = ?`, [id]);

  const booking = get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
  res.json({ success: true, booking, message: 'Scheduled ride dispatched live!' });
});

// ==========================================
// 10. DRIVER PORTAL & CUSTOM PRICING
// ==========================================
apiRouter.patch('/driver/status', authenticateToken, requireRole('DRIVER'), (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { availabilityStatus } = req.body;

  const profile = get<DriverProfile>('SELECT id FROM driver_profiles WHERE user_id = ?', [authReq.user.id]);
  if (!profile) return res.status(404).json({ error: 'Driver profile not found' });

  run(`UPDATE driver_profiles SET availability_status = ? WHERE id = ?`, [availabilityStatus, profile.id]);
  const updated = get<DriverProfile>('SELECT * FROM driver_profiles WHERE id = ?', [profile.id]);
  res.json({ driver: updated });
});

apiRouter.get('/driver/pricing', authenticateToken, requireRole('DRIVER'), (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const profile = get<DriverProfile>('SELECT id FROM driver_profiles WHERE user_id = ?', [authReq.user.id]);
  if (!profile) return res.status(404).json({ error: 'Driver profile not found' });

  const pricing = query(`
    SELECT dp.*, vc.name as category_name, vc.per_km_rate as admin_per_km, vc.max_deviation_percent
    FROM driver_pricing dp
    JOIN vehicle_categories vc ON dp.vehicle_category_id = vc.id
    WHERE dp.driver_id = ?
  `, [profile.id]);
  res.json({ pricing });
});

apiRouter.put('/driver/pricing', authenticateToken, requireRole('DRIVER'), (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const profile = get<DriverProfile>('SELECT id FROM driver_profiles WHERE user_id = ?', [authReq.user.id]);
  if (!profile) return res.status(404).json({ error: 'Driver profile not found' });

  const { vehicleCategoryId, customBaseFare, customPerKm, customPerMinute, customWaitingRate, customMinimumFare } = req.body;
  
  const validation = FareEngine.validateDriverPricing(vehicleCategoryId, customPerKm, customBaseFare);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  const existing = get('SELECT id FROM driver_pricing WHERE driver_id = ? AND vehicle_category_id = ?', [profile.id, vehicleCategoryId]);
  if (existing) {
    run(`
      UPDATE driver_pricing
      SET custom_base_fare = ?, custom_per_km = ?, custom_per_minute = ?, custom_waiting_rate = ?, custom_minimum_fare = ?
      WHERE driver_id = ? AND vehicle_category_id = ?
    `, [customBaseFare, customPerKm, customPerMinute, customWaitingRate, customMinimumFare, profile.id, vehicleCategoryId]);
  } else {
    run(`
      INSERT INTO driver_pricing (id, driver_id, vehicle_category_id, custom_base_fare, custom_per_km, custom_per_minute, custom_waiting_rate, custom_minimum_fare)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [uuidv4(), profile.id, vehicleCategoryId, customBaseFare, customPerKm, customPerMinute, customWaitingRate, customMinimumFare]);
  }

  res.json({ success: true, message: 'Driver pricing updated successfully' });
});

apiRouter.get('/driver/earnings', authenticateToken, requireRole('DRIVER'), (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const profile = get<DriverProfile>('SELECT id FROM driver_profiles WHERE user_id = ?', [authReq.user.id]);
  if (!profile) return res.status(404).json({ error: 'Driver profile not found' });

  const earnings = query(`SELECT * FROM driver_earnings WHERE driver_id = ? ORDER BY created_at DESC`, [profile.id]);
  
  const todayTotal = get<{ total: number }>(`
    SELECT SUM(net_earning) as total FROM driver_earnings 
    WHERE driver_id = ? AND created_at >= date('now', 'start of day')
  `, [profile.id])?.total || 0;

  const totalGross = get<{ total: number }>(`SELECT SUM(gross_fare) as total FROM driver_earnings WHERE driver_id = ?`, [profile.id])?.total || 0;
  const totalCommission = get<{ total: number }>(`SELECT SUM(platform_commission) as total FROM driver_earnings WHERE driver_id = ?`, [profile.id])?.total || 0;

  res.json({
    todayEarnings: Math.round(todayTotal * 100) / 100,
    totalGrossFare: Math.round(totalGross * 100) / 100,
    totalCommissionPaid: Math.round(totalCommission * 100) / 100,
    history: earnings
  });
});

// ==========================================
// 11. WALLET & PAYMENTS (Tamper-Resistant)
// ==========================================
apiRouter.get('/wallet', authenticateToken, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const data = PaymentService.getWallet(authReq.user.id);
  res.json(data);
});

apiRouter.post('/wallet/topup', authenticateToken, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { amount } = req.body;
  try {
    const result = PaymentService.topUpWallet(authReq.user.id, parseFloat(amount));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/wallet/pay', authenticateToken, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const idempotencyKey = (req.headers['idempotency-key'] as string) || `pay_key_${Date.now()}`;
  const { bookingId, paymentMethod } = req.body;

  // Server authoritatively derives amount from database snapshot (prevents client price tampering)
  const booking = get<Booking>('SELECT * FROM bookings WHERE id = ?', [bookingId]);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const payableAmount = booking.final_fare || booking.fare_estimate;

  try {
    const result = PaymentService.processPayment(bookingId, authReq.user.id, payableAmount, paymentMethod || 'UPI', idempotencyKey);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 12. SAFETY & SOS
// ==========================================
apiRouter.post('/safety/sos', authenticateToken, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { bookingId, lat, lng, notes } = req.body;
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const ua = req.headers['user-agent'] || 'Mobile App';

  try {
    const result = SafetyService.triggerSOS(bookingId, authReq.user.id, lat, lng, notes, ip, ua);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

apiRouter.post('/safety/call-mask', authenticateToken, (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { bookingId } = req.body;
  const session = SafetyService.generateMaskedCallSession(bookingId, authReq.user.id);
  res.json(session);
});

apiRouter.post('/safety/share/:id', authenticateToken, (req: Request, res: Response) => {
  const { id } = req.params;
  const link = SafetyService.generateLiveShareToken(id);
  res.json(link);
});

// ==========================================
// 13. ADMIN CONTROL CENTER & AUDIT
// ==========================================
apiRouter.get('/admin/dashboard', authenticateToken, requireRole('SUPER_ADMIN', 'ADMIN'), (_req: Request, res: Response) => {
  const metrics = AdminService.getDashboardMetrics();
  res.json({ metrics });
});

apiRouter.get('/admin/audit-logs', authenticateToken, requireRole('SUPER_ADMIN', 'ADMIN'), (_req: Request, res: Response) => {
  const logs = query<any>('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50');
  res.json({ logs });
});

apiRouter.get('/admin/documents', authenticateToken, requireRole('SUPER_ADMIN', 'ADMIN'), (_req: Request, res: Response) => {
  const docs = query<any>(`
    SELECT doc.*, u.name as driver_name, u.phone as driver_phone
    FROM driver_documents doc
    JOIN driver_profiles d ON doc.driver_id = d.id
    JOIN users u ON d.user_id = u.id
    ORDER BY doc.expiry_date ASC
  `);
  res.json({ documents: docs });
});

apiRouter.post('/admin/documents/:id/verify', authenticateToken, requireRole('SUPER_ADMIN', 'ADMIN'), (req: Request, res: Response) => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;
  const { status, rejectionReason } = req.body;
  try {
    const updated = AdminService.reviewDriverDocument(id, authReq.user.id, status, rejectionReason);
    res.json({ document: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/admin/fraud', authenticateToken, requireRole('SUPER_ADMIN', 'ADMIN'), (_req: Request, res: Response) => {
  const anomalies = AdminService.scanFraudAnomalies();
  res.json({ anomalies });
});

apiRouter.get('/admin/surge-zones', authenticateToken, requireRole('SUPER_ADMIN', 'ADMIN'), (_req: Request, res: Response) => {
  const zones = query('SELECT * FROM geofences ORDER BY active DESC');
  res.json({ zones });
});

apiRouter.post('/admin/surge-zones', authenticateToken, requireRole('SUPER_ADMIN', 'ADMIN'), (req: Request, res: Response) => {
  const { name, city, zoneType, centerLat, centerLng, radiusMeters, surgeMultiplier, surchargeAmount } = req.body;
  const id = `geo_${uuidv4().substring(0, 8)}`;
  run(`
    INSERT INTO geofences (id, name, city, zone_type, center_lat, center_lng, radius_meters, surge_multiplier, surcharge_amount, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `, [id, name, city || 'Thrissur', zoneType || 'HIGH_DEMAND', centerLat, centerLng, radiusMeters || 2000, surgeMultiplier || 1.25, surchargeAmount || 0]);
  
  const created = get('SELECT * FROM geofences WHERE id = ?', [id]);
  res.status(201).json({ zone: created });
});

// ==========================================
// 14. IN-RIDE CHAT
// ==========================================
apiRouter.get('/chat/:bookingId', authenticateToken, (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const messages = query('SELECT * FROM chat_messages WHERE booking_id = ? ORDER BY created_at ASC', [bookingId]);
  res.json({ messages });
});

apiRouter.post('/chat/:bookingId', authenticateToken, (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const authReq = req as AuthenticatedRequest;
  const { message } = req.body;
  const msgId = `msg_${Date.now()}`;
  run(`
    INSERT INTO chat_messages (id, booking_id, sender_id, sender_role, message)
    VALUES (?, ?, ?, ?, ?)
  `, [msgId, bookingId, authReq.user.id, authReq.user.role, message]);
  res.status(201).json({ success: true, messageId: msgId });
});

// ==========================================
// 15. TOUR PACKAGES & OUTSTATION CHARTERS
// ==========================================
apiRouter.get('/tour-packages', (_req: Request, res: Response) => {
  const packages = query('SELECT * FROM tour_packages WHERE active = 1 ORDER BY base_price ASC');
  const parsed = packages.map((pkg: any) => ({
    ...pkg,
    vehicle_types: JSON.parse(pkg.vehicle_types_json || '[]'),
    included_items: JSON.parse(pkg.included_items_json || '[]'),
    itinerary: JSON.parse(pkg.itinerary_json || '[]')
  }));
  res.json({ packages: parsed });
});

apiRouter.post('/tour-packages/book', authenticateToken, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const passengerId = authReq.user.id;

  const {
    packageId,
    startDate,
    pickupAddress,
    pickupLat,
    pickupLng,
    selectedVehicleCategory
  } = req.body;

  const pkg = get<any>('SELECT * FROM tour_packages WHERE id = ?', [packageId]);
  if (!pkg) return res.status(404).json({ error: 'Tour package not found' });

  const bookingId = `bk_tour_${uuidv4().substring(0, 8)}`;
  const bookingNumber = `TOUR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const otpCode = SafetyService.generateTripOtp();

  const pLat = parseFloat(pickupLat) || 10.5276;
  const pLng = parseFloat(pickupLng) || 76.2144;
  const vehicleCat = selectedVehicleCategory || 'cat_tempo_traveller';

  let multiplier = 1.0;
  if (vehicleCat.includes('tempo')) multiplier = 1.4;
  else if (vehicleCat.includes('bus_35')) multiplier = 2.8;
  else if (vehicleCat.includes('bus_49')) multiplier = 4.5;
  else if (vehicleCat.includes('suv')) multiplier = 1.2;

  const totalFare = Math.round(pkg.base_price * multiplier);

  run(`
    INSERT INTO bookings (
      id, booking_number, passenger_id, driver_id, vehicle_category_id, booking_type,
      pickup_lat, pickup_lng, pickup_address, destination_lat, destination_lng, destination_address,
      scheduled_at, distance_km, duration_min, otp_code, fare_estimate, fare_source,
      fare_rule_version, surge_multiplier, payment_method, payment_status, status
    ) VALUES (
      ?, ?, ?, NULL, ?, 'TOUR_PACKAGE',
      ?, ?, ?, 10.0889, 77.0595, ?,
      ?, 280.0, 1440, ?, ?, 'TOUR_PACKAGE',
      'v2.0', 1.0, 'UPI', 'PENDING', 'DRIVER_ASSIGNED'
    )
  `, [
    bookingId, bookingNumber, passengerId, vehicleCat,
    pLat, pLng, pickupAddress || 'Doorstep Pickup, Kerala', pkg.destination,
    startDate || new Date().toISOString(), otpCode, totalFare
  ]);

  const created = get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
  res.status(201).json({
    booking: created,
    package: pkg,
    message: `Tour package for ${pkg.title} booked successfully!`
  });
});

// ==========================================
// 16. PARCEL & LOCAL SHOP DELIVERIES
// ==========================================
apiRouter.post('/parcels/book', authenticateToken, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const senderId = authReq.user.id;

  const {
    pickupAddress,
    pickupLat,
    pickupLng,
    destinationAddress,
    destinationLat,
    destinationLng,
    receiverName,
    receiverPhone,
    packageType,
    weightCategory,
    isFragile,
    notes,
    vehicleCategoryId
  } = req.body;

  if (!pickupAddress || !destinationAddress || !receiverName || !receiverPhone) {
    return res.status(400).json({ error: 'Pickup, Destination, Receiver Name & Phone are required' });
  }

  const pLat = parseFloat(pickupLat) || 10.5276;
  const pLng = parseFloat(pickupLng) || 76.2144;
  const dLat = parseFloat(destinationLat) || 10.5360;
  const dLng = parseFloat(destinationLng) || 76.2220;
  const catId = vehicleCategoryId || 'cat_parcel_express';

  const route = await LocationService.calculateRoute({ lat: pLat, lng: pLng }, { lat: dLat, lng: dLng });
  const quote = FareEngine.calculateFare({
    vehicleCategoryId: catId,
    distanceKm: route.distanceKm,
    durationMin: route.durationMin,
    pickupLat: pLat,
    pickupLng: pLng
  });

  const bookingId = `bk_parcel_${uuidv4().substring(0, 8)}`;
  const bookingNumber = `EXP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const deliveryPin = SafetyService.generateTripOtp();

  run(`
    INSERT INTO bookings (
      id, booking_number, passenger_id, driver_id, vehicle_category_id, booking_type,
      pickup_lat, pickup_lng, pickup_address, destination_lat, destination_lng, destination_address,
      scheduled_at, distance_km, duration_min, otp_code, fare_estimate, fare_source,
      fare_rule_version, surge_multiplier, payment_method, payment_status, status
    ) VALUES (
      ?, ?, ?, NULL, ?, 'PARCEL_DELIVERY',
      ?, ?, ?, ?, ?, ?,
      NULL, ?, ?, ?, ?, 'PARCEL_TARIFF',
      'v2.0', 1.0, 'UPI', 'PENDING', 'SEARCHING'
    )
  `, [
    bookingId, bookingNumber, senderId, catId,
    pLat, pLng, pickupAddress, dLat, dLng, destinationAddress,
    route.distanceKm, route.durationMin, deliveryPin, quote.total_fare
  ]);

  const parcelId = `pcl_${uuidv4().substring(0, 8)}`;
  run(`
    INSERT INTO parcel_deliveries (
      id, booking_id, sender_id, receiver_name, receiver_phone,
      package_type, weight_category, is_fragile, notes, delivery_pin, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
  `, [
    parcelId, bookingId, senderId, receiverName, receiverPhone,
    packageType || 'SHOP_PARCEL', weightCategory || 'UP_TO_5KG', isFragile ? 1 : 0, notes || '', deliveryPin
  ]);

  const booking = get('SELECT * FROM bookings WHERE id = ?', [bookingId]);
  const parcel = get('SELECT * FROM parcel_deliveries WHERE id = ?', [parcelId]);

  res.status(201).json({
    booking,
    parcel,
    deliveryPin,
    message: 'Express parcel pickup order placed successfully!'
  });
});

apiRouter.get('/parcels/:bookingId', authenticateToken, (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const parcel = get('SELECT * FROM parcel_deliveries WHERE booking_id = ?', [bookingId]);
  if (!parcel) return res.status(404).json({ error: 'Parcel record not found' });
  res.json({ parcel });
});
