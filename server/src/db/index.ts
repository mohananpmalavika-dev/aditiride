import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { SCHEMA_SQL } from './schema.js';

let dbInstance: Database | null = null;
const DB_FILE_PATH = path.resolve(process.cwd(), 'aditiride.sqlite');

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE_PATH);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (err) {
      console.warn('Could not read existing database file, creating fresh DB:', err);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // Initialize schema
  dbInstance.run(SCHEMA_SQL);
  seedDatabase(dbInstance);
  saveDb();

  return dbInstance;
}

export function saveDb(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE_PATH, buffer);
  } catch (err) {
    console.error('Error saving SQLite database to disk:', err);
  }
}

export function query<T = any>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

export function get<T = any>(sql: string, params: any[] = []): T | undefined {
  const results = query<T>(sql, params);
  return results[0];
}

export function run(sql: string, params: any[] = []): { changes: number } {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.run(sql, params);
  saveDb();
  return { changes: 1 };
}

function seedDatabase(db: Database) {
  // Check if already seeded
  const userCheck = db.exec("SELECT COUNT(*) as count FROM users");
  const count = userCheck[0]?.values[0]?.[0] as number || 0;
  if (count > 0) return;

  console.log('Seeding initial AditiRide marketplace catalog, verified drivers, and users...');

  // 1. Vehicle Categories
  const categories = [
    {
      id: 'cat_bike',
      code: 'BIKE',
      name: 'Bike Taxi',
      display_name: 'Aditi Bike',
      description: 'Fast, solo commute through city traffic with helmet provided.',
      vehicle_class: 'TWO_WHEELER',
      passenger_capacity: 1,
      luggage_capacity: 1,
      base_fare: 25.0,
      minimum_fare: 35.0,
      per_km_rate: 9.0,
      per_minute_rate: 1.5,
      waiting_rate: 1.5,
      booking_fee: 5.0,
      platform_fee: 5.0,
      tax_percent: 5.0,
      commission_percent: 10.0,
      cancellation_fee: 20.0,
      night_charge_multiplier: 1.2,
      surge_enabled: 1,
      driver_custom_fare_allowed: 1,
      max_deviation_percent: 20.0,
      admin_fare_enabled: 1,
      active: 1,
      sort_order: 1,
      icon: 'Bike',
      image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=150'
    },
    {
      id: 'cat_auto',
      code: 'AUTO',
      name: 'Auto Rickshaw',
      display_name: 'Aditi Auto',
      description: 'Iconic 3-wheeler for quick, reliable point-to-point urban rides.',
      vehicle_class: 'THREE_WHEELER',
      passenger_capacity: 3,
      luggage_capacity: 2,
      base_fare: 35.0,
      minimum_fare: 50.0,
      per_km_rate: 14.0,
      per_minute_rate: 2.0,
      waiting_rate: 2.0,
      booking_fee: 7.0,
      platform_fee: 5.0,
      tax_percent: 5.0,
      commission_percent: 12.0,
      cancellation_fee: 25.0,
      night_charge_multiplier: 1.25,
      surge_enabled: 1,
      driver_custom_fare_allowed: 1,
      max_deviation_percent: 20.0,
      admin_fare_enabled: 1,
      active: 1,
      sort_order: 2,
      icon: 'Compass',
      image: 'https://images.unsplash.com/photo-1596707328905-24d1683beae8?w=150'
    },
    {
      id: 'cat_economy',
      code: 'MINI',
      name: 'Economy Car',
      display_name: 'Aditi Mini / Go',
      description: 'Budget-friendly AC hatchbacks for everyday solo or pair trips.',
      vehicle_class: 'CAR',
      passenger_capacity: 4,
      luggage_capacity: 2,
      base_fare: 60.0,
      minimum_fare: 90.0,
      per_km_rate: 16.0,
      per_minute_rate: 2.5,
      waiting_rate: 2.5,
      booking_fee: 10.0,
      platform_fee: 8.0,
      tax_percent: 5.0,
      commission_percent: 15.0,
      cancellation_fee: 40.0,
      night_charge_multiplier: 1.25,
      surge_enabled: 1,
      driver_custom_fare_allowed: 1,
      max_deviation_percent: 20.0,
      admin_fare_enabled: 1,
      active: 1,
      sort_order: 3,
      icon: 'Car',
      image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=150'
    },
    {
      id: 'cat_sedan',
      code: 'SEDAN',
      name: 'Comfort Sedan',
      display_name: 'Aditi Prime Sedan',
      description: 'Spacious sedans with top-rated drivers, AC, and smooth legroom.',
      vehicle_class: 'CAR',
      passenger_capacity: 4,
      luggage_capacity: 3,
      base_fare: 80.0,
      minimum_fare: 120.0,
      per_km_rate: 20.0,
      per_minute_rate: 3.0,
      waiting_rate: 3.0,
      booking_fee: 12.0,
      platform_fee: 10.0,
      tax_percent: 5.0,
      commission_percent: 18.0,
      cancellation_fee: 50.0,
      night_charge_multiplier: 1.3,
      surge_enabled: 1,
      driver_custom_fare_allowed: 1,
      max_deviation_percent: 20.0,
      admin_fare_enabled: 1,
      active: 1,
      sort_order: 4,
      icon: 'ShieldCheck',
      image: 'https://images.unsplash.com/photo-1550355291-bbee04a92027?w=150'
    },
    {
      id: 'cat_suv',
      code: 'SUV',
      name: 'SUV / XL',
      display_name: 'Aditi XL (6 Seater)',
      description: 'Room for 6+ passengers and large luggage. Ideal for families and airport trips.',
      vehicle_class: 'XL',
      passenger_capacity: 6,
      luggage_capacity: 4,
      base_fare: 120.0,
      minimum_fare: 180.0,
      per_km_rate: 26.0,
      per_minute_rate: 3.5,
      waiting_rate: 3.5,
      booking_fee: 15.0,
      platform_fee: 12.0,
      tax_percent: 5.0,
      commission_percent: 20.0,
      cancellation_fee: 60.0,
      night_charge_multiplier: 1.3,
      surge_enabled: 1,
      driver_custom_fare_allowed: 1,
      max_deviation_percent: 20.0,
      admin_fare_enabled: 1,
      active: 1,
      sort_order: 5,
      icon: 'Truck',
      image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=150'
    },
    {
      id: 'cat_rental',
      code: 'RENTAL',
      name: 'Hourly Rental',
      display_name: 'Aditi Rentals',
      description: 'Keep the car and driver with you for multiple stops (1h/10km or 2h/20km packages).',
      vehicle_class: 'SPECIAL',
      passenger_capacity: 4,
      luggage_capacity: 3,
      base_fare: 299.0, // 1h / 10km package
      minimum_fare: 299.0,
      per_km_rate: 18.0, // excess km
      per_minute_rate: 3.0, // excess min
      waiting_rate: 2.5,
      booking_fee: 20.0,
      platform_fee: 15.0,
      tax_percent: 5.0,
      commission_percent: 18.0,
      cancellation_fee: 75.0,
      night_charge_multiplier: 1.25,
      surge_enabled: 0,
      driver_custom_fare_allowed: 0,
      max_deviation_percent: 15.0,
      admin_fare_enabled: 1,
      active: 1,
      sort_order: 6,
      icon: 'Clock',
      image: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=150'
    },
    {
      id: 'cat_outstation',
      code: 'OUTSTATION',
      name: 'Outstation Travel',
      display_name: 'Aditi Outstation Intercity',
      description: 'Comfortable intercity one-way or round-trip journeys with driver allowance included.',
      vehicle_class: 'SPECIAL',
      passenger_capacity: 4,
      luggage_capacity: 4,
      base_fare: 800.0,
      minimum_fare: 1200.0,
      per_km_rate: 19.0,
      per_minute_rate: 0.0,
      waiting_rate: 2.0,
      booking_fee: 50.0,
      platform_fee: 30.0,
      tax_percent: 5.0,
      commission_percent: 15.0,
      cancellation_fee: 150.0,
      night_charge_multiplier: 1.2,
      surge_enabled: 1,
      driver_custom_fare_allowed: 1,
      max_deviation_percent: 25.0,
      admin_fare_enabled: 1,
      active: 1,
      sort_order: 7,
      icon: 'Navigation',
      image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=150'
    }
  ];

  for (const cat of categories) {
    db.run(`
      INSERT INTO vehicle_categories (
        id, code, name, display_name, description, vehicle_class, passenger_capacity, luggage_capacity,
        base_fare, minimum_fare, per_km_rate, per_minute_rate, waiting_rate, booking_fee, platform_fee,
        tax_percent, commission_percent, cancellation_fee, night_charge_multiplier, surge_enabled,
        driver_custom_fare_allowed, max_deviation_percent, admin_fare_enabled, active, sort_order, icon, image
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cat.id, cat.code, cat.name, cat.display_name, cat.description, cat.vehicle_class, cat.passenger_capacity,
      cat.luggage_capacity, cat.base_fare, cat.minimum_fare, cat.per_km_rate, cat.per_minute_rate, cat.waiting_rate,
      cat.booking_fee, cat.platform_fee, cat.tax_percent, cat.commission_percent, cat.cancellation_fee,
      cat.night_charge_multiplier, cat.surge_enabled, cat.driver_custom_fare_allowed, cat.max_deviation_percent,
      cat.admin_fare_enabled, cat.active, cat.sort_order, cat.icon, cat.image
    ]);
  }

  // 2. Users (Admin, Passenger, Drivers, Fleet)
  const users = [
    {
      id: 'usr_admin_mgdhanya',
      username: 'mgdhanyamohan',
      phone: '+919876543210',
      email: 'mgdhanyamohan@aditiride.com',
      name: 'MG Dhanya Mohan (Super Admin)',
      role: 'SUPER_ADMIN',
      password: 'Thathu@110',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      emergency: '+919999999999',
      lang: 'en'
    },
    {
      id: 'usr_passenger',
      username: 'dhanya',
      phone: '+919447123456',
      email: 'dhanya@aditiride.com',
      name: 'Dhanya Menon',
      role: 'PASSENGER',
      password: 'Thathu@110',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      emergency: '+919447998877',
      lang: 'en'
    },
    {
      id: 'usr_driver_rahul',
      username: 'rahul',
      phone: '+919846111222',
      email: 'rahul.driver@aditiride.com',
      name: 'Rahul Nair',
      role: 'DRIVER',
      password: 'Thathu@110',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      emergency: '+919846000001',
      lang: 'ml'
    },
    {
      id: 'usr_driver_arun',
      username: 'arun',
      phone: '+919846333444',
      email: 'arun.driver@aditiride.com',
      name: 'Arun Kumar',
      role: 'DRIVER',
      password: 'Thathu@110',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      emergency: '+919846000002',
      lang: 'ml'
    },
    {
      id: 'usr_driver_priya',
      username: 'priya',
      phone: '+919846555666',
      email: 'priya.driver@aditiride.com',
      name: 'Priya K.',
      role: 'DRIVER',
      password: 'Thathu@110',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      emergency: '+919846000003',
      lang: 'en'
    },
    {
      id: 'usr_driver_suresh',
      username: 'suresh',
      phone: '+919846777888',
      email: 'suresh.driver@aditiride.com',
      name: 'Suresh Babu',
      role: 'DRIVER',
      password: 'Thathu@110',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
      emergency: '+919846000004',
      lang: 'hi'
    },
    {
      id: 'usr_fleet',
      username: 'keralacabs',
      phone: '+919846999000',
      email: 'fleet@keralacabs.com',
      name: 'Kerala Star Mobility Fleet',
      role: 'FLEET_MANAGER',
      password: 'Thathu@110',
      avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150',
      emergency: '+919846999999',
      lang: 'en'
    }
  ];

  for (const u of users) {
    db.run(`
      INSERT INTO users (id, username, phone, email, name, role, password_hash, avatar_url, emergency_contact, preferred_language, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `, [u.id, u.username, u.phone, u.email, u.name, u.role, u.password, u.avatar, u.emergency, u.lang]);
  }

  // 3. Passenger Profile
  db.run(`
    INSERT INTO passenger_profiles (id, user_id, default_vehicle_category_id, default_payment_method, wallet_balance, rating_avg, total_rides)
    VALUES ('prof_passenger_1', 'usr_passenger', 'cat_auto', 'UPI', 1250.0, 4.95, 18)
  `);

  db.run(`
    INSERT INTO wallets (id, user_id, balance, currency)
    VALUES ('wal_passenger_1', 'usr_passenger', 1250.0, 'INR')
  `);

  // 4. Driver Profiles & Vehicles
  // Driver 1: Rahul Nair (Sedan - Top Rated Favorite Driver)
  db.run(`
    INSERT INTO driver_profiles (
      id, user_id, verification_status, availability_status, current_lat, current_lng, heading,
      rating_avg, acceptance_rate, cancellation_rate, total_trips, custom_fare_enabled, accepts_favorite_requests,
      accepts_scheduled_rides, accepts_airport_rides, accepts_outstation, accepts_cash, operating_zone
    ) VALUES ('drv_rahul', 'usr_driver_rahul', 'VERIFIED', 'ONLINE', 10.5280, 76.2150, 45, 4.96, 0.98, 0.01, 84, 1, 1, 1, 1, 1, 1, 'Thrissur Town')
  `);
  db.run(`
    INSERT INTO vehicles (
      id, driver_id, vehicle_category_id, vehicle_type, brand, model, year, color, plate_number,
      seating_capacity, luggage_capacity, ac_enabled, is_ev, wheelchair_accessible, pet_friendly, child_seat_available, dashcam_equipped, status
    ) VALUES ('veh_rahul', 'drv_rahul', 'cat_sedan', 'Sedan', 'Honda', 'City V', 2024, 'Pearl White', 'KL-08-BW-7777', 4, 3, 1, 0, 1, 1, 1, 1, 'ACTIVE')
  `);
  db.run(`
    INSERT INTO driver_pricing (
      id, driver_id, vehicle_category_id, custom_base_fare, custom_per_km, custom_per_minute, custom_waiting_rate, custom_minimum_fare, status, approved_by_admin
    ) VALUES ('dp_rahul', 'drv_rahul', 'cat_sedan', 85.0, 22.0, 3.0, 3.0, 130.0, 'ACTIVE', 1)
  `);

  // Driver 2: Arun Kumar (Auto Rickshaw)
  db.run(`
    INSERT INTO driver_profiles (
      id, user_id, verification_status, availability_status, current_lat, current_lng, heading,
      rating_avg, acceptance_rate, cancellation_rate, total_trips, custom_fare_enabled, accepts_favorite_requests,
      accepts_scheduled_rides, accepts_airport_rides, accepts_outstation, accepts_cash, operating_zone
    ) VALUES ('drv_arun', 'usr_driver_arun', 'VERIFIED', 'ONLINE', 10.5250, 76.2110, 120, 4.88, 0.94, 0.02, 142, 1, 1, 1, 1, 0, 1, 'Swaraj Round')
  `);
  db.run(`
    INSERT INTO vehicles (
      id, driver_id, vehicle_category_id, vehicle_type, brand, model, year, color, plate_number,
      seating_capacity, luggage_capacity, ac_enabled, is_ev, wheelchair_accessible, pet_friendly, child_seat_available, dashcam_equipped, status
    ) VALUES ('veh_arun', 'drv_arun', 'cat_auto', 'Auto', 'Bajaj', 'Compact RE', 2023, 'Yellow & Black', 'KL-08-CC-2345', 3, 2, 0, 0, 0, 1, 0, 0, 'ACTIVE')
  `);
  db.run(`
    INSERT INTO driver_pricing (
      id, driver_id, vehicle_category_id, custom_base_fare, custom_per_km, custom_per_minute, custom_waiting_rate, custom_minimum_fare, status, approved_by_admin
    ) VALUES ('dp_arun', 'drv_arun', 'cat_auto', 35.0, 15.0, 2.0, 2.0, 50.0, 'ACTIVE', 1)
  `);

  // Driver 3: Priya K. (Economy Car / Women-Preferred / EV)
  db.run(`
    INSERT INTO driver_profiles (
      id, user_id, verification_status, availability_status, current_lat, current_lng, heading,
      rating_avg, acceptance_rate, cancellation_rate, total_trips, custom_fare_enabled, accepts_favorite_requests,
      accepts_scheduled_rides, accepts_airport_rides, accepts_outstation, accepts_cash, operating_zone
    ) VALUES ('drv_priya', 'usr_driver_priya', 'VERIFIED', 'ONLINE', 10.5310, 76.2200, 270, 4.98, 0.99, 0.00, 62, 0, 1, 1, 1, 1, 1, 'East Fort')
  `);
  db.run(`
    INSERT INTO vehicles (
      id, driver_id, vehicle_category_id, vehicle_type, brand, model, year, color, plate_number,
      seating_capacity, luggage_capacity, ac_enabled, is_ev, wheelchair_accessible, pet_friendly, child_seat_available, dashcam_equipped, status
    ) VALUES ('veh_priya', 'drv_priya', 'cat_economy', 'Hatchback', 'Tata', 'Tiago EV', 2024, 'Teal Blue', 'KL-08-EV-9090', 4, 2, 1, 1, 1, 1, 1, 1, 'ACTIVE')
  `);

  // Driver 4: Suresh Babu (Bike Taxi)
  db.run(`
    INSERT INTO driver_profiles (
      id, user_id, verification_status, availability_status, current_lat, current_lng, heading,
      rating_avg, acceptance_rate, cancellation_rate, total_trips, custom_fare_enabled, accepts_favorite_requests,
      accepts_scheduled_rides, accepts_airport_rides, accepts_outstation, accepts_cash, operating_zone
    ) VALUES ('drv_suresh', 'usr_driver_suresh', 'VERIFIED', 'ONLINE', 10.5230, 76.2160, 90, 4.82, 0.91, 0.04, 210, 1, 1, 0, 0, 0, 1, 'KSRTC Stand')
  `);
  db.run(`
    INSERT INTO vehicles (
      id, driver_id, vehicle_category_id, vehicle_type, brand, model, year, color, plate_number,
      seating_capacity, luggage_capacity, ac_enabled, is_ev, wheelchair_accessible, pet_friendly, child_seat_available, dashcam_equipped, status
    ) VALUES ('veh_suresh', 'drv_suresh', 'cat_bike', 'Motorcycle', 'Hero', 'Splendor Plus', 2023, 'Jet Black', 'KL-08-AZ-4512', 1, 1, 0, 0, 0, 0, 0, 0, 'ACTIVE')
  `);

  // 5. Driver Documents
  const docs = [
    { id: 'doc_1', drv: 'drv_rahul', type: 'LICENSE', num: 'DL-08-20150009876', exp: '2030-10-15' },
    { id: 'doc_2', drv: 'drv_rahul', type: 'RC', num: 'RC-KL08BW7777', exp: '2039-05-20' },
    { id: 'doc_3', drv: 'drv_rahul', type: 'INSURANCE', num: 'INS-HDFC-998822', exp: '2027-04-12' },
    { id: 'doc_4', drv: 'drv_arun', type: 'LICENSE', num: 'DL-08-20180004321', exp: '2028-08-01' },
    { id: 'doc_5', drv: 'drv_priya', type: 'LICENSE', num: 'DL-08-20200001122', exp: '2032-12-30' }
  ];
  for (const d of docs) {
    db.run(`
      INSERT INTO driver_documents (id, driver_id, doc_type, doc_number, file_url, expiry_date, verification_status, verified_by, verified_at)
      VALUES (?, ?, ?, ?, 'https://aditiride.com/docs/verified_badge.pdf', ?, 'VERIFIED', 'usr_admin', datetime('now'))
    `, [d.id, d.drv, d.type, d.num, d.exp]);
  }

  // 6. Favorite Relationship (Dhanya loves Rahul Nair's smooth driving)
  db.run(`
    INSERT INTO favorites (id, passenger_id, driver_id, status)
    VALUES ('fav_dhanya_rahul', 'usr_passenger', 'drv_rahul', 'ACTIVE')
  `);

  // 7. Geofences & Surge Zones
  const zones = [
    {
      id: 'geo_cochin_airport',
      name: 'Cochin International Airport (COK)',
      city: 'Kochi',
      zone_type: 'AIRPORT',
      lat: 10.1518,
      lng: 76.3930,
      radius: 3500,
      surge: 1.15,
      surcharge: 100.0
    },
    {
      id: 'geo_thrissur_swaraj',
      name: 'Thrissur Swaraj Round & High Street',
      city: 'Thrissur',
      zone_type: 'HIGH_DEMAND',
      lat: 10.5276,
      lng: 76.2144,
      radius: 2000,
      surge: 1.25,
      surcharge: 0.0
    }
  ];
  for (const z of zones) {
    db.run(`
      INSERT INTO geofences (id, name, city, zone_type, center_lat, center_lng, radius_meters, surge_multiplier, surcharge_amount, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [z.id, z.name, z.city, z.zone_type, z.lat, z.lng, z.radius, z.surge, z.surcharge]);
  }

  // 8. Sample Past Completed Booking for One-Tap Rebook
  db.run(`
    INSERT INTO bookings (
      id, booking_number, passenger_id, driver_id, vehicle_id, vehicle_category_id,
      booking_type, pickup_lat, pickup_lng, pickup_address,
      destination_lat, destination_lng, destination_address,
      distance_km, duration_min, otp_code, fare_estimate, final_fare, fare_source,
      fare_rule_version, surge_multiplier, payment_method, payment_status, status,
      created_at, completed_at
    ) VALUES (
      'bk_sample_past_1', 'ADITI-2026-8910', 'usr_passenger', 'drv_rahul', 'veh_rahul', 'cat_sedan',
      'INSTANT', 10.5276, 76.2144, 'Swaraj Round, Thrissur',
      10.5360, 76.2220, 'Lulu International Shopping Mall, Thrissur',
      4.2, 14, '5821', 185.0, 185.0, 'DRIVER_CUSTOM',
      '1.0', 1.0, 'UPI', 'COMPLETED', 'COMPLETED',
      datetime('now', '-1 day'), datetime('now', '-1 day', '+20 minutes')
    )
  `);

  // 9. Feature Flags (from PRD Appendix B)
  const flags = [
    { key: 'driver_pricing', desc: 'Allow drivers to configure bounded custom fares' },
    { key: 'driver_offer_bidding', desc: 'Enable driver bidding and quotes for outstation' },
    { key: 'favorite_drivers', desc: 'Enable marking drivers as favorite' },
    { key: 'favorite_direct_requests', desc: 'Direct booking dispatch to favorite drivers' },
    { key: 'scheduled_rides', desc: 'Allow booking rides for future dates & times' },
    { key: 'recurring_rides', desc: 'Weekly/daily repeating commuter rides' },
    { key: 'voice_booking', desc: 'Multi-lingual voice booking engine' },
    { key: 'cash_payments', desc: 'Allow cash settlement upon trip completion' },
    { key: 'wallet', desc: 'In-app AditiRide wallet balance and credits' },
    { key: 'dynamic_pricing', desc: 'Automatic surge pricing based on demand & zones' },
    { key: 'multi_stop', desc: 'Multi-stop rides with dynamic re-routing' },
    { key: 'rentals', desc: 'Hourly rental packages' },
    { key: 'outstation', desc: 'City-to-city outstation one-way & round-trip' },
    { key: 'accessible_service', desc: 'Wheelchair & assisted mobility filters' },
    { key: 'pet_friendly', desc: 'Pet-friendly vehicle filters' },
    { key: 'women_preference', desc: 'Women-driver preference options' },
    { key: 'corporate_accounts', desc: 'Enterprise billing & employee cost centers' },
    { key: 'fleet_portal', desc: 'Fleet operator and multi-vehicle dispatch' },
    { key: 'route_anomaly_detection', desc: 'Real-time safety route deviation alerts' },
    { key: 'audio_safety_recording', desc: 'Encrypted in-trip safety audio recording' }
  ];
  for (const f of flags) {
    db.run(`INSERT INTO feature_flags (key, enabled, description) VALUES (?, 1, ?)`, [f.key, f.desc]);
  }

  // 10. Audit Log Initial Event
  db.run(`
    INSERT INTO audit_logs (id, actor_user_id, actor_role, action, entity_type, entity_id, new_values, ip_address, user_agent)
    VALUES ('aud_init', 'usr_admin', 'SUPER_ADMIN', 'SYSTEM_INITIALIZED', 'PLATFORM', 'aditiride_v1', '{"version": "1.0", "status": "READY"}', '127.0.0.1', 'Antigravity Kernel')
  `);

  console.log('AditiRide platform seed complete.');
}
