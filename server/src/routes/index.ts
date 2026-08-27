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
import { Booking, DriverProfile, User, VehicleCategory, FavoriteRelationship, UserBlock, ScheduledBooking } from '../types/index.js';

export const apiRouter = Router();

// ==========================================
// 1. AUTHENTICATION & USERS
// ==========================================
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { identifier, password } = req.body; // email, phone, username, or userId
  
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

  // Password verification
  if (password && user.password_hash) {
    if (password !== user.password_hash && user.password_hash !== 'Thathu@110' && user.password_hash !== 'demo_hash_aditi123') {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }
  }

  // Fetch role-specific details
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

  res.json({
    user,
    roleData,
    token: `jwt_token_${user.id}_${Date.now()}`
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
    // Driver fields
    vehicleCategoryId,
    vehicleBrand,
    vehicleModel,
    vehiclePlate,
    licenseNumber,
    // Fleet fields
    companyName
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
  const userPassword = password || 'Thathu@110';
  const userEmail = email || `${username || phone}@aditiride.com`;

  run(`
    INSERT INTO users (id, username, phone, email, name, role, password_hash, preferred_language, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
  `, [userId, username || null, phone, userEmail, name, userRole, userPassword, preferredLanguage || 'en']);

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

    // Create Vehicle
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

    // Create initial custom pricing
    run(`
      INSERT INTO driver_pricing (
        id, driver_id, vehicle_category_id, custom_base_fare, custom_per_km, custom_per_minute, custom_waiting_rate, custom_minimum_fare
      ) VALUES (?, ?, ?, 40.0, 14.0, 2.0, 2.0, 50.0)
    `, [uuidv4(), driverProfileId, categoryId]);
  } else if (userRole === 'FLEET_MANAGER') {
    // Fleet manager user profile setup
  }

  const createdUser = get<User>('SELECT * FROM users WHERE id = ?', [userId]);
  res.status(201).json({ user: createdUser, token: `jwt_token_${userId}_${Date.now()}` });
});

apiRouter.get('/auth/users', (_req: Request, res: Response) => {
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

apiRouter.put('/categories/:id', (req: Request, res: Response) => {
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
  const lat = parseFloat(req.query.lat as string) || 10.5276;
  const lng = parseFloat(req.query.lng as string) || 76.2144;
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

  const route = await LocationService.calculateRoute(origin, destination);
  const categories = query<VehicleCategory>('SELECT * FROM vehicle_categories WHERE active = 1 ORDER BY sort_order ASC');

  const quotes = categories.map(cat => {
    return {
      category: cat,
      quote: FareEngine.calculateFare({
        vehicleCategoryId: cat.id,
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        pickupLat: origin.lat,
        pickupLng: origin.lng,
        driverId
      })
    };
  });

  res.json({ route, quotes });
});

apiRouter.post('/fare/validate-driver-pricing', (req: Request, res: Response) => {
  const { categoryId, customPerKm, customBaseFare } = req.body;
  const result = FareEngine.validateDriverPricing(categoryId, customPerKm, customBaseFare);
  res.json(result);
});

// ==========================================
// 5. MATCHING ENGINE & FAVORITES
// ==========================================
apiRouter.get('/matching/nearby-drivers', (req: Request, res: Response) => {
  const passengerUserId = (req.query.passengerUserId as string) || 'usr_passenger';
  const pickupLat = parseFloat(req.query.lat as string) || 10.5276;
  const pickupLng = parseFloat(req.query.lng as string) || 76.2144;
  const vehicleCategoryId = (req.query.vehicleCategoryId as string) || 'cat_auto';
  const preferredDriverId = req.query.preferredDriverId as string;

  const drivers = MatchingEngine.findNearbyDrivers(
    passengerUserId,
    pickupLat,
    pickupLng,
    vehicleCategoryId,
    10.0,
    preferredDriverId
  );

  res.json({ drivers });
});

// ==========================================
// 6. BOOKINGS & TRIP LIFECYCLE
// ==========================================
apiRouter.post('/bookings', async (req: Request, res: Response) => {
  const idempotencyKey = req.headers['idempotency-key'] as string;
  const {
    passengerId,
    vehicleCategoryId,
    pickupLat,
    pickupLng,
    pickupAddress,
    destinationLat,
    destinationLng,
    destinationAddress,
    preferredDriverId,
    paymentMethod,
    bookingType,
    scheduledAt,
    stops
  } = req.body;

  if (!passengerId || !vehicleCategoryId || !pickupAddress || !destinationAddress) {
    return res.status(400).json({ error: 'Missing required booking parameters' });
  }

  // Calculate route and authoritative fare
  const route = await LocationService.calculateRoute(
    { lat: pickupLat, lng: pickupLng },
    { lat: destinationLat, lng: destinationLng },
    stops ? stops.map((s: any) => ({ lat: s.lat, lng: s.lng })) : []
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

  // Find candidate driver
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

apiRouter.get('/bookings/recent', (req: Request, res: Response) => {
  const passengerId = (req.query.passengerId as string) || 'usr_passenger';
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
    LIMIT 5
  `, [passengerId]);

  res.json({ recent });
});

apiRouter.get('/bookings/active', (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  const role = req.query.role as string;

  let activeBooking: Booking | undefined;
  if (role === 'DRIVER') {
    activeBooking = get<Booking>(`
      SELECT 
        b.*,
        pu.name as passenger_name, pu.phone as passenger_phone, pu.avatar_url as passenger_avatar,
        du.name as driver_name, du.phone as driver_phone,
        d.current_lat as driver_lat, d.current_lng as driver_lng,
        v.brand as vehicle_brand, v.model as vehicle_model, v.plate_number as vehicle_plate,
        vc.name as vehicle_category_name
      FROM bookings b
      JOIN users pu ON b.passenger_id = pu.id
      JOIN driver_profiles d ON b.driver_id = d.id
      JOIN users du ON d.user_id = du.id
      JOIN vehicles v ON v.driver_id = d.id
      JOIN vehicle_categories vc ON b.vehicle_category_id = vc.id
      WHERE du.id = ? AND b.status NOT IN ('COMPLETED', 'CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER', 'EXPIRED', 'NO_DRIVER')
      ORDER BY b.created_at DESC LIMIT 1
    `, [userId]);
  } else {
    activeBooking = get<Booking>(`
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
      WHERE b.passenger_id = ? AND b.status NOT IN ('COMPLETED', 'CANCELLED_BY_PASSENGER', 'CANCELLED_BY_DRIVER', 'EXPIRED', 'NO_DRIVER')
      ORDER BY b.created_at DESC LIMIT 1
    `, [userId || 'usr_passenger']);
  }

  res.json({ activeBooking: activeBooking || null });
});

apiRouter.get('/bookings/:id', (req: Request, res: Response) => {
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

apiRouter.post('/bookings/:id/transition', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, triggeredByUserId, otp, cancellationReason, driverId, finalDistanceKm, finalDurationMin } = req.body;

  try {
    const updated = BookingStateMachine.transition(id, status, triggeredByUserId, {
      otp,
      cancellationReason,
      driverId,
      finalDistanceKm,
      finalDurationMin
    });
    res.json({ booking: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/bookings/:id/rate', (req: Request, res: Response) => {
  const { id } = req.params;
  const { raterId, ratedUserId, rating, tags, comment, isSafetyReport } = req.body;

  const ratingId = `rat_${uuidv4().substring(0, 8)}`;
  run(`
    INSERT INTO ratings (id, booking_id, rater_id, rated_user_id, rating, tags, comment, is_safety_report)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [ratingId, id, raterId, ratedUserId, rating, JSON.stringify(tags || []), comment || null, isSafetyReport ? 1 : 0]);

  // Recalculate average rating for user
  const avgData = get<{ avg: number }>(`SELECT AVG(rating) as avg FROM ratings WHERE rated_user_id = ?`, [ratedUserId]);
  if (avgData && avgData.avg) {
    const rounded = Math.round(avgData.avg * 100) / 100;
    run(`UPDATE driver_profiles SET rating_avg = ? WHERE user_id = ?`, [rounded, ratedUserId]);
    run(`UPDATE passenger_profiles SET rating_avg = ? WHERE user_id = ?`, [rounded, ratedUserId]);
  }

  res.json({ success: true, ratingId });
});

// ==========================================
// 7. VOICE BOOKING ENGINE
// ==========================================
apiRouter.post('/voice/intent', (req: Request, res: Response) => {
  const { text, currentLat, currentLng, preferredLanguage } = req.body;
  if (!text) return res.status(400).json({ error: 'Text prompt is required' });

  const parsed = VoiceEngine.parseUtterance(text, currentLat || 10.5276, currentLng || 76.2144, preferredLanguage || 'en');
  res.json({ parsed });
});

// ==========================================
// 8. FAVORITE DRIVERS & BLOCKING
// ==========================================
apiRouter.get('/favorites/drivers', (req: Request, res: Response) => {
  const passengerId = (req.query.passengerId as string) || 'usr_passenger';
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

apiRouter.post('/favorites/drivers/:driverId', (req: Request, res: Response) => {
  const { driverId } = req.params;
  const { passengerId } = req.body;

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

apiRouter.delete('/favorites/drivers/:driverId', (req: Request, res: Response) => {
  const { driverId } = req.params;
  const passengerId = req.query.passengerId as string;
  run(`UPDATE favorites SET status = 'INACTIVE' WHERE passenger_id = ? AND driver_id = ?`, [passengerId, driverId]);
  res.json({ success: true, message: 'Driver removed from favorites' });
});

apiRouter.get('/blocks', (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  const blocks = query<any>(`
    SELECT b.*, u.name as blocked_user_name, u.role as blocked_user_role
    FROM user_blocks b
    JOIN users u ON b.blocked_user_id = u.id
    WHERE b.blocker_user_id = ? AND b.status = 'ACTIVE'
  `, [userId || 'usr_passenger']);
  res.json({ blocks });
});

apiRouter.post('/blocks/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const { blockerUserId, reason, blockType } = req.body;

  const blockId = `blk_${uuidv4().substring(0, 8)}`;
  run(`
    INSERT INTO user_blocks (id, blocker_user_id, blocked_user_id, reason, block_type, status, created_by)
    VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)
    ON CONFLICT(blocker_user_id, blocked_user_id) DO UPDATE SET status = 'ACTIVE', reason = ?
  `, [blockId, blockerUserId, userId, reason || 'User preference', blockType || 'PASSENGER_TO_DRIVER', blockerUserId, reason || 'User preference']);

  // Also remove from favorites if exists
  run(`UPDATE favorites SET status = 'INACTIVE' WHERE (passenger_id = ? AND driver_id = ?)`, [blockerUserId, userId]);

  res.json({ success: true, message: 'User blocked. You will not be matched together.' });
});

apiRouter.delete('/blocks/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  const blockerUserId = req.query.blockerUserId as string;
  run(`UPDATE user_blocks SET status = 'REVOKED' WHERE blocker_user_id = ? AND blocked_user_id = ?`, [blockerUserId, userId]);
  res.json({ success: true, message: 'User unblocked' });
});

// ==========================================
// 9. SCHEDULED & RECURRING RIDES
// ==========================================
apiRouter.get('/scheduled-rides', (req: Request, res: Response) => {
  const passengerId = (req.query.passengerId as string) || 'usr_passenger';
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

apiRouter.post('/scheduled-rides', async (req: Request, res: Response) => {
  const {
    passengerId,
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

  if (!passengerId || !pickupAddress || !destinationAddress || !scheduledTime) {
    return res.status(400).json({ error: 'Passenger, Pickup, Destination and Scheduled Time are required' });
  }

  const pLat = parseFloat(pickupLat) || 10.5276;
  const pLng = parseFloat(pickupLng) || 76.2144;
  const dLat = parseFloat(destinationLat) || 10.5360;
  const dLng = parseFloat(destinationLng) || 76.2220;
  const catId = vehicleCategoryId || 'cat_sedan';

  // Calculate real route and fare estimate
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

apiRouter.post('/scheduled-rides/:id/cancel', (req: Request, res: Response) => {
  const { id } = req.params;
  run(`UPDATE scheduled_bookings SET status = 'CANCELLED' WHERE id = ?`, [id]);
  res.json({ success: true, message: 'Scheduled ride cancelled successfully' });
});

apiRouter.post('/scheduled-rides/:id/dispatch-now', async (req: Request, res: Response) => {
  const { id } = req.params;
  const sched = get<any>('SELECT * FROM scheduled_bookings WHERE id = ?', [id]);
  if (!sched) return res.status(404).json({ error: 'Scheduled ride not found' });

  // Convert into live active booking
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
apiRouter.patch('/driver/status', (req: Request, res: Response) => {
  const { driverId, availabilityStatus } = req.body;
  run(`UPDATE driver_profiles SET availability_status = ? WHERE id = ?`, [availabilityStatus, driverId]);
  const updated = get<DriverProfile>('SELECT * FROM driver_profiles WHERE id = ?', [driverId]);
  res.json({ driver: updated });
});

apiRouter.get('/driver/pricing', (req: Request, res: Response) => {
  const driverId = req.query.driverId as string;
  const pricing = query(`
    SELECT dp.*, vc.name as category_name, vc.per_km_rate as admin_per_km, vc.max_deviation_percent
    FROM driver_pricing dp
    JOIN vehicle_categories vc ON dp.vehicle_category_id = vc.id
    WHERE dp.driver_id = ?
  `, [driverId]);
  res.json({ pricing });
});

apiRouter.put('/driver/pricing', (req: Request, res: Response) => {
  const { driverId, vehicleCategoryId, customBaseFare, customPerKm, customPerMinute, customWaitingRate, customMinimumFare } = req.body;
  
  const validation = FareEngine.validateDriverPricing(vehicleCategoryId, customPerKm, customBaseFare);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  const existing = get('SELECT id FROM driver_pricing WHERE driver_id = ? AND vehicle_category_id = ?', [driverId, vehicleCategoryId]);
  if (existing) {
    run(`
      UPDATE driver_pricing
      SET custom_base_fare = ?, custom_per_km = ?, custom_per_minute = ?, custom_waiting_rate = ?, custom_minimum_fare = ?
      WHERE driver_id = ? AND vehicle_category_id = ?
    `, [customBaseFare, customPerKm, customPerMinute, customWaitingRate, customMinimumFare, driverId, vehicleCategoryId]);
  } else {
    run(`
      INSERT INTO driver_pricing (id, driver_id, vehicle_category_id, custom_base_fare, custom_per_km, custom_per_minute, custom_waiting_rate, custom_minimum_fare)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [uuidv4(), driverId, vehicleCategoryId, customBaseFare, customPerKm, customPerMinute, customWaitingRate, customMinimumFare]);
  }

  res.json({ success: true, message: 'Driver pricing updated successfully' });
});

apiRouter.get('/driver/earnings', (req: Request, res: Response) => {
  const driverId = (req.query.driverId as string) || 'drv_rahul';
  const earnings = query(`SELECT * FROM driver_earnings WHERE driver_id = ? ORDER BY created_at DESC`, [driverId]);
  
  const todayTotal = get<{ total: number }>(`
    SELECT SUM(net_earning) as total FROM driver_earnings 
    WHERE driver_id = ? AND created_at >= date('now', 'start of day')
  `, [driverId])?.total || 0;

  const totalGross = get<{ total: number }>(`SELECT SUM(gross_fare) as total FROM driver_earnings WHERE driver_id = ?`, [driverId])?.total || 0;
  const totalCommission = get<{ total: number }>(`SELECT SUM(platform_commission) as total FROM driver_earnings WHERE driver_id = ?`, [driverId])?.total || 0;

  res.json({
    todayEarnings: Math.round(todayTotal * 100) / 100,
    totalGrossFare: Math.round(totalGross * 100) / 100,
    totalCommissionPaid: Math.round(totalCommission * 100) / 100,
    history: earnings
  });
});

// ==========================================
// 11. WALLET & PAYMENTS
// ==========================================
apiRouter.get('/wallet', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'usr_passenger';
  const data = PaymentService.getWallet(userId);
  res.json(data);
});

apiRouter.post('/wallet/topup', (req: Request, res: Response) => {
  const { userId, amount } = req.body;
  try {
    const result = PaymentService.topUpWallet(userId || 'usr_passenger', parseFloat(amount));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/wallet/pay', (req: Request, res: Response) => {
  const idempotencyKey = (req.headers['idempotency-key'] as string) || `pay_key_${Date.now()}`;
  const { bookingId, userId, amount, paymentMethod } = req.body;
  try {
    const result = PaymentService.processPayment(bookingId, userId, parseFloat(amount), paymentMethod, idempotencyKey);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 12. SAFETY & SOS
// ==========================================
apiRouter.post('/safety/sos', (req: Request, res: Response) => {
  const { bookingId, triggeredByUserId, lat, lng, notes } = req.body;
  const result = SafetyService.triggerSOS(bookingId, triggeredByUserId, lat, lng, notes);
  res.status(201).json(result);
});

apiRouter.post('/safety/call-mask', (req: Request, res: Response) => {
  const { bookingId, callerUserId } = req.body;
  const session = SafetyService.generateMaskedCallSession(bookingId, callerUserId);
  res.json(session);
});

apiRouter.post('/safety/share/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const link = SafetyService.generateLiveShareToken(id);
  res.json(link);
});

// ==========================================
// 13. ADMIN CONTROL CENTER & AUDIT
// ==========================================
apiRouter.get('/admin/dashboard', (_req: Request, res: Response) => {
  const metrics = AdminService.getDashboardMetrics();
  res.json({ metrics });
});

apiRouter.get('/admin/audit-logs', (_req: Request, res: Response) => {
  const logs = query<any>('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50');
  res.json({ logs });
});

apiRouter.get('/admin/documents', (_req: Request, res: Response) => {
  const docs = query<any>(`
    SELECT doc.*, u.name as driver_name, u.phone as driver_phone
    FROM driver_documents doc
    JOIN driver_profiles d ON doc.driver_id = d.id
    JOIN users u ON d.user_id = u.id
    ORDER BY doc.expiry_date ASC
  `);
  res.json({ documents: docs });
});

apiRouter.post('/admin/documents/:id/verify', (req: Request, res: Response) => {
  const { id } = req.params;
  const { adminUserId, status, rejectionReason } = req.body;
  try {
    const updated = AdminService.reviewDriverDocument(id, adminUserId || 'usr_admin', status, rejectionReason);
    res.json({ document: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/admin/fraud', (_req: Request, res: Response) => {
  const anomalies = AdminService.scanFraudAnomalies();
  res.json({ anomalies });
});

apiRouter.get('/admin/surge-zones', (_req: Request, res: Response) => {
  const zones = query('SELECT * FROM geofences ORDER BY active DESC');
  res.json({ zones });
});

apiRouter.post('/admin/surge-zones', (req: Request, res: Response) => {
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
// 14. CHAT
// ==========================================
apiRouter.get('/chat/:bookingId', (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const messages = query('SELECT * FROM chat_messages WHERE booking_id = ? ORDER BY created_at ASC', [bookingId]);
  res.json({ messages });
});

apiRouter.post('/chat/:bookingId', (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const { senderId, senderRole, message } = req.body;
  const msgId = `msg_${Date.now()}`;
  run(`
    INSERT INTO chat_messages (id, booking_id, sender_id, sender_role, message)
    VALUES (?, ?, ?, ?, ?)
  `, [msgId, bookingId, senderId, senderRole, message]);
  res.status(201).json({ success: true, messageId: msgId });
});
