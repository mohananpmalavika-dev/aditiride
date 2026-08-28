import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { SCHEMA_SQL } from './schema.js';
import { hashPassword } from '../middleware/auth.js';

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

  // SQLite Alter Table column migrations
  try {
    dbInstance.run("ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'LOCAL'");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE users ADD COLUMN google_id TEXT");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE driver_profiles ADD COLUMN free_pickup_km REAL DEFAULT 2.0");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE driver_profiles ADD COLUMN pickup_charge_per_km REAL DEFAULT 10.0");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE driver_pricing ADD COLUMN free_pickup_km REAL DEFAULT 2.0");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE driver_pricing ADD COLUMN pickup_charge_per_km REAL DEFAULT 10.0");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE bookings ADD COLUMN waiting_minutes REAL DEFAULT 0.0");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE bookings ADD COLUMN waiting_fare REAL DEFAULT 0.0");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE bookings ADD COLUMN waiting_rate REAL DEFAULT 2.5");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE bookings ADD COLUMN waiting_status TEXT DEFAULT 'NONE'");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE bookings ADD COLUMN waiting_started_at TEXT");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE bookings ADD COLUMN stop_address TEXT");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE bookings ADD COLUMN is_booking_for_other INTEGER DEFAULT 0");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE bookings ADD COLUMN rider_name TEXT");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE bookings ADD COLUMN rider_phone TEXT");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE bookings ADD COLUMN rider_payment_mode TEXT DEFAULT 'BOOKER_PAYS'");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE bookings ADD COLUMN recurring_series_id TEXT");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE feature_flags ADD COLUMN maturity TEXT DEFAULT 'NOT_IMPLEMENTED'");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE audit_logs ADD COLUMN sequence_number INTEGER");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE audit_logs ADD COLUMN previous_event_hash TEXT");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE audit_logs ADD COLUMN event_hash TEXT");
  } catch {}
  try {
    dbInstance.run("ALTER TABLE audit_logs ADD COLUMN payload_hash TEXT");
  } catch {}

  seedFeatureFlags(dbInstance);
  seedDatabase(dbInstance);

  // Upgrade any non-bcrypt user passwords to secure bcrypt hashes
  try {
    const unhashedUsers = dbInstance.exec("SELECT id, password_hash FROM users WHERE password_hash NOT LIKE '$2%'");
    if (unhashedUsers[0]?.values) {
      for (const row of unhashedUsers[0].values) {
        const uid = row[0] as string;
        const plain = (row[1] as string) || 'Thathu@110';
        const newHash = hashPassword(plain);
        dbInstance.run("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, uid]);
      }
    }
  } catch {}

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

let inTransaction = false;

export function run(sql: string, params: any[] = []): { changes: number } {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.run(sql, params);
  if (!inTransaction) {
    saveDb();
  }
  return { changes: 1 };
}

export function transaction<T>(fn: () => T): T {
  if (!dbInstance) throw new Error('Database not initialized');
  if (inTransaction) {
    return fn();
  }

  inTransaction = true;
  dbInstance.run('BEGIN TRANSACTION;');
  try {
    const result = fn();
    dbInstance.run('COMMIT;');
    inTransaction = false;
    saveDb();
    return result;
  } catch (error) {
    try {
      dbInstance.run('ROLLBACK;');
    } catch {}
    inTransaction = false;
    throw error;
  }
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
    },
    {
      id: 'cat_pickup',
      code: 'PICKUP',
      name: 'Pickup Truck',
      display_name: 'Aditi Pickup / Tata Ace',
      description: 'Mini trucks and pickups for shifting, furniture, appliances, and shop goods (up to 1.5 Ton).',
      vehicle_class: 'COMMERCIAL',
      passenger_capacity: 2,
      luggage_capacity: 15,
      base_fare: 350.0,
      minimum_fare: 450.0,
      per_km_rate: 32.0,
      per_minute_rate: 3.0,
      waiting_rate: 3.0,
      booking_fee: 25.0,
      platform_fee: 20.0,
      tax_percent: 5.0,
      commission_percent: 15.0,
      cancellation_fee: 100.0,
      night_charge_multiplier: 1.25,
      surge_enabled: 1,
      driver_custom_fare_allowed: 1,
      max_deviation_percent: 25.0,
      admin_fare_enabled: 1,
      active: 1,
      sort_order: 8,
      icon: 'Truck',
      image: 'https://images.unsplash.com/photo-1586191582152-4467c69a5843?w=150'
    },
    {
      id: 'cat_lorry_14ft',
      code: 'LORRY_14FT',
      name: '14ft Lorry',
      display_name: '14ft Goods Lorry (4 Ton)',
      description: 'Medium commercial lorry for home relocation, timber, commercial inventory & wholesale consignments.',
      vehicle_class: 'HEAVY_COMMERCIAL',
      passenger_capacity: 2,
      luggage_capacity: 40,
      base_fare: 750.0,
      minimum_fare: 1000.0,
      per_km_rate: 48.0,
      per_minute_rate: 4.0,
      waiting_rate: 4.0,
      booking_fee: 40.0,
      platform_fee: 35.0,
      tax_percent: 5.0,
      commission_percent: 15.0,
      cancellation_fee: 200.0,
      night_charge_multiplier: 1.25,
      surge_enabled: 1,
      driver_custom_fare_allowed: 1,
      max_deviation_percent: 25.0,
      admin_fare_enabled: 1,
      active: 1,
      sort_order: 9,
      icon: 'Truck',
      image: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=150'
    },
    {
      id: 'cat_truck_20ft',
      code: 'TRUCK_20FT',
      name: 'Heavy Container Truck',
      display_name: '20ft Heavy Truck (10 Ton)',
      description: 'Heavy duty long-haul carrier for industrial raw materials, factory machinery & bulk cargo.',
      vehicle_class: 'HEAVY_COMMERCIAL',
      passenger_capacity: 2,
      luggage_capacity: 100,
      base_fare: 1500.0,
      minimum_fare: 2200.0,
      per_km_rate: 75.0,
      per_minute_rate: 5.0,
      waiting_rate: 5.0,
      booking_fee: 80.0,
      platform_fee: 60.0,
      tax_percent: 5.0,
      commission_percent: 15.0,
      cancellation_fee: 400.0,
      night_charge_multiplier: 1.25,
      surge_enabled: 1,
      driver_custom_fare_allowed: 1,
      max_deviation_percent: 25.0,
      admin_fare_enabled: 1,
      active: 1,
      sort_order: 10,
      icon: 'Truck',
      image: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=150'
    },
    {
      id: 'cat_tempo_traveller',
      code: 'TEMPO_TRAVELLER',
      name: 'Tempo Traveller',
      display_name: 'Luxury Tempo Traveller (17/26 Seater)',
      description: 'Spacious AC pushback seats, surround audio system & roof carrier for family functions & tours.',
      vehicle_class: 'BUS_COACH',
      passenger_capacity: 26,
      luggage_capacity: 20,
      base_fare: 1200.0,
      minimum_fare: 1800.0,
      per_km_rate: 34.0,
      per_minute_rate: 3.0,
      waiting_rate: 3.0,
      booking_fee: 50.0,
      platform_fee: 40.0,
      tax_percent: 5.0,
      commission_percent: 15.0,
      cancellation_fee: 300.0,
      night_charge_multiplier: 1.2,
      surge_enabled: 0,
      driver_custom_fare_allowed: 1,
      max_deviation_percent: 20.0,
      admin_fare_enabled: 1,
      active: 1,
      sort_order: 11,
      icon: 'Bus',
      image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=150'
    },
    {
      id: 'cat_bus_35',
      code: 'BUS_35',
      name: '35 Seater Tourist Bus',
      display_name: '35-Seater Deluxe Tourist Coach',
      description: 'Deluxe AC tourist bus with individual charging, LED TV, air suspension & experienced tour driver.',
      vehicle_class: 'BUS_COACH',
      passenger_capacity: 35,
      luggage_capacity: 35,
      base_fare: 2500.0,
      minimum_fare: 3500.0,
      per_km_rate: 62.0,
      per_minute_rate: 4.0,
      waiting_rate: 4.0,
      booking_fee: 100.0,
      platform_fee: 80.0,
      tax_percent: 5.0,
      commission_percent: 15.0,
      cancellation_fee: 500.0,
      night_charge_multiplier: 1.2,
      surge_enabled: 0,
      driver_custom_fare_allowed: 1,
      max_deviation_percent: 20.0,
      admin_fare_enabled: 1,
      active: 1,
      sort_order: 12,
      icon: 'Bus',
      image: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=150'
    },
    {
      id: 'cat_bus_49',
      code: 'BUS_49',
      name: '49 Seater Luxury Coach',
      display_name: '49-Seater Multi-Axle Luxury Bus (Volvo/Scania)',
      description: 'Ultra-luxury sleeper/semi-sleeper coach with restroom, air suspension, WiFi & premium tour amenities.',
      vehicle_class: 'BUS_COACH',
      passenger_capacity: 49,
      luggage_capacity: 50,
      base_fare: 4500.0,
      minimum_fare: 6000.0,
      per_km_rate: 92.0,
      per_minute_rate: 5.0,
      waiting_rate: 5.0,
      booking_fee: 150.0,
      platform_fee: 120.0,
      tax_percent: 5.0,
      commission_percent: 15.0,
      cancellation_fee: 1000.0,
      night_charge_multiplier: 1.2,
      surge_enabled: 0,
      driver_custom_fare_allowed: 1,
      max_deviation_percent: 20.0,
      admin_fare_enabled: 1,
      active: 1,
      sort_order: 13,
      icon: 'Bus',
      image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=150'
    },
    {
      id: 'cat_parcel_express',
      code: 'PARCEL',
      name: 'Parcel & Shop Delivery',
      display_name: 'Aditi Express Parcel & Shop Delivery',
      description: 'Instant local delivery of documents, food, medicines, keys, and retail store orders with secure PIN.',
      vehicle_class: 'PARCEL',
      passenger_capacity: 0,
      luggage_capacity: 10,
      base_fare: 40.0,
      minimum_fare: 50.0,
      per_km_rate: 11.0,
      per_minute_rate: 1.5,
      waiting_rate: 1.5,
      booking_fee: 5.0,
      platform_fee: 5.0,
      tax_percent: 5.0,
      commission_percent: 10.0,
      cancellation_fee: 25.0,
      night_charge_multiplier: 1.2,
      surge_enabled: 1,
      driver_custom_fare_allowed: 1,
      max_deviation_percent: 20.0,
      admin_fare_enabled: 1,
      active: 1,
      sort_order: 14,
      icon: 'Package',
      image: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?w=150'
    }
  ];

  for (const cat of categories) {
    db.run(`
      INSERT OR REPLACE INTO vehicle_categories (
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

  // Seed Curated Tour Packages
  const tourPackages = [
    {
      id: 'tour_munnar_2d1n',
      title: 'Munnar Misty Hills & Tea Gardens',
      subtitle: '2 Days / 1 Night • Mattupetty Dam, Top Station & Tea Plantation Safari',
      destination: 'Munnar, Idukki',
      duration_days: 2,
      duration_nights: 1,
      base_price: 6499.0,
      vehicle_types_json: JSON.stringify(['Sedan', 'SUV', 'Tempo Traveller']),
      included_items_json: JSON.stringify([
        'Doorstep Pickup & Drop (AC Car/Traveller)',
        'Toll, Parking & Fuel included',
        'Expert Malayalam/English Tour Driver',
        'Sightseeing at Eravikulam National Park & Tea Museum'
      ]),
      itinerary_json: JSON.stringify([
        { day: 1, title: 'Scenic Hill Climb & Dam Sightseeing', desc: 'Cheeyappara Waterfalls, Valara Viewpoint, Mattupetty Dam & Echo Point boating.' },
        { day: 2, title: 'Tea Plantation & Top Station', desc: 'Sunrise at Top Station, Tea Museum tour, Rose Garden & return drop.' }
      ]),
      image_url: 'https://images.unsplash.com/photo-1602643163983-ed0babc39797?w=600',
      badge: 'Bestseller',
      rating: 4.95
    },
    {
      id: 'tour_wayanad_3d2n',
      title: 'Wayanad Wildlife, Caves & Waterfalls',
      subtitle: '3 Days / 2 Nights • Edakkal Caves, Banasura Sagar & Safari',
      destination: 'Wayanad, Kerala',
      duration_days: 3,
      duration_nights: 2,
      base_price: 9800.0,
      vehicle_types_json: JSON.stringify(['Sedan', 'SUV', 'Tempo Traveller', 'Mini Coach']),
      included_items_json: JSON.stringify([
        'Private Dedicated Vehicle for all 3 days',
        'Experienced Driver with local sightseeing knowledge',
        'All Interstate permit charges included',
        'Banasura Sagar Dam speedboat assistance'
      ]),
      itinerary_json: JSON.stringify([
        { day: 1, title: 'Banasura Sagar Dam & Karlad Lake', desc: 'Speedboating, zip-lining and relaxing sunset at Karlad.' },
        { day: 2, title: 'Edakkal Caves & Soochipara Falls', desc: 'Neolithic cave hike, spice plantation tour and waterfall trekking.' },
        { day: 3, title: 'Muthanga Wildlife Safari & Return', desc: 'Morning elephant & deer safari in reserve forest, Chembra peak view and return.' }
      ]),
      image_url: 'https://images.unsplash.com/photo-1588661759663-718cfaec65b9?w=600',
      badge: 'Adventure Special',
      rating: 4.9
    },
    {
      id: 'tour_alleppey_houseboat',
      title: 'Alleppey Backwaters & Houseboat Cruise',
      subtitle: '1 Day / Overnight • Punnamada Lake, Vembanad Cruise & Village Life',
      destination: 'Alappuzha, Kerala',
      duration_days: 1,
      duration_nights: 1,
      base_price: 5200.0,
      vehicle_types_json: JSON.stringify(['Sedan', 'SUV', 'Tempo Traveller']),
      included_items_json: JSON.stringify([
        'Private Cab Pickup & Return Drop',
        'Direct Houseboat Boarding Assistance',
        'Traditional Kerala Lunch & Evening Tea on Boat',
        'Sunset Backwater Cruise in Vembanad Lake'
      ]),
      itinerary_json: JSON.stringify([
        { day: 1, title: 'Backwater Leisure Cruise', desc: 'Board traditional Kettuvallam houseboat, sail through paddy fields, canals and village lagoons.' }
      ]),
      image_url: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=600',
      badge: 'Romantic & Family',
      rating: 4.98
    },
    {
      id: 'tour_sabarimala_guruvayur',
      title: 'Sabarimala & Guruvayur Pilgrimage Darshan',
      subtitle: '2 Days / 1 Night • Nilakkal/Pamba or Guruvayur-Vadakkumnathan Temple Circuit',
      destination: 'Sabarimala / Guruvayur, Kerala',
      duration_days: 2,
      duration_nights: 1,
      base_price: 4800.0,
      vehicle_types_json: JSON.stringify(['Sedan', 'SUV', 'Tempo Traveller', '35s Tourist Bus', '49s Luxury Coach']),
      included_items_json: JSON.stringify([
        'Special Devotee Pilgrimage Certified Captains',
        '24/7 Waiting & Multi-stop Darshan Circuit',
        'Comfortable Night Travel with Pushback Seating',
        'Luggage Space for Irumudi & Travel Bags'
      ]),
      itinerary_json: JSON.stringify([
        { day: 1, title: 'Temple Pickup & Journey', desc: 'Evening departure with devotional hymns, early morning arrival at Pamba/Guruvayur.' },
        { day: 2, title: 'Darshan, Prasad & Return', desc: 'Special darshan queue coordination, afternoon return trip.' }
      ]),
      image_url: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600',
      badge: 'Pilgrimage Special',
      rating: 4.96
    }
  ];

  for (const tour of tourPackages) {
    db.run(`
      INSERT OR REPLACE INTO tour_packages (
        id, title, subtitle, destination, duration_days, duration_nights, base_price,
        vehicle_types_json, included_items_json, itinerary_json, image_url, badge, rating, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tour.id, tour.title, tour.subtitle, tour.destination, tour.duration_days, tour.duration_nights, tour.base_price,
      tour.vehicle_types_json, tour.included_items_json, tour.itinerary_json, tour.image_url, tour.badge, tour.rating, 1
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
    const pwdHash = hashPassword(u.password);
    db.run(`
      INSERT INTO users (id, username, phone, email, name, role, password_hash, avatar_url, emergency_contact, preferred_language, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `, [u.id, u.username, u.phone, u.email, u.name, u.role, pwdHash, u.avatar, u.emergency, u.lang]);
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

  // 9. Feature Flags (from PRD Appendix B with maturity lifecycle)
  seedFeatureFlags(db);

  // 10. Ride Passes & Loyalty Commute Packages (PRD §13)
  const passes = [
    {
      id: 'pass_auto_commute_10',
      name: '10-Ride Auto Daily Commuter Pass',
      desc: 'Save flat ₹40 per auto ride across Thrissur & Kochi. Valid for 30 days.',
      price: 199.0,
      total_rides: 10,
      discount: 40.0,
      cat: 'cat_auto',
      color: 'amber'
    },
    {
      id: 'pass_sedan_airport_5',
      name: '5-Ride Airport & Prime Sedan Pass',
      desc: 'Save flat ₹100 on every airport or intercity Sedan trip. Priority Captain match.',
      price: 349.0,
      total_rides: 5,
      discount: 100.0,
      cat: 'cat_sedan',
      color: 'indigo'
    },
    {
      id: 'pass_unlimited_saver',
      name: 'Kerala City Unlimited Zero-Surge Pass',
      desc: '100% surge fee waiver on all vehicle classes during rain, festivals & peak hours.',
      price: 499.0,
      total_rides: 20,
      discount: 50.0,
      cat: null,
      color: 'emerald'
    }
  ];
  for (const p of passes) {
    db.run(`
      INSERT OR IGNORE INTO ride_passes (id, name, description, price, total_rides, discount_per_ride, vehicle_category_id, validity_days, badge_color, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 30, ?, 1)
    `, [p.id, p.name, p.desc, p.price, p.total_rides, p.discount, p.cat, p.color]);
  }

  // 11. Driver Compliance Documents (PRD §9.5 & §15)
  const complianceDocs = [
    { id: 'cdoc_rahul_dl', drv: 'drv_rahul', type: 'DRIVING_LICENSE', num: 'KL-08-2018-009412', status: 'APPROVED' },
    { id: 'cdoc_rahul_rc', drv: 'drv_rahul', type: 'VEHICLE_RC', num: 'KL-08-BQ-4512', status: 'APPROVED' },
    { id: 'cdoc_rahul_ins', drv: 'drv_rahul', type: 'INSURANCE', num: 'BAJAJ-ALL-894125', status: 'APPROVED' },
    { id: 'cdoc_arun_dl', drv: 'drv_arun', type: 'DRIVING_LICENSE', num: 'KL-07-2020-004819', status: 'PENDING' },
    { id: 'cdoc_arun_rc', drv: 'drv_arun', type: 'VEHICLE_RC', num: 'KL-07-CS-7890', status: 'PENDING' }
  ];
  for (const doc of complianceDocs) {
    db.run(`
      INSERT OR IGNORE INTO driver_compliance_documents (id, driver_id, document_type, document_number, document_url, expiry_date, verification_status, verified_by, verified_at)
      VALUES (?, ?, ?, ?, 'https://aditiride.com/docs/compliance_preview.pdf', '2028-12-31', ?, 'usr_admin', datetime('now'))
    `, [doc.id, doc.drv, doc.type, doc.num, doc.status]);
  }

  // 12. Sample Lost & Found Item (PRD §14.3)
  db.run(`
    INSERT OR IGNORE INTO lost_and_found_items (id, booking_id, passenger_id, driver_id, item_category, item_description, contact_phone, return_fee, status, driver_notes)
    VALUES ('lf_sample_1', 'bk_sample_past_1', 'usr_passenger', 'drv_rahul', 'BAG', 'Black leather handbag with college books left in backseat', '+919847000001', 150.0, 'REPORTED', 'Captain Rahul notified to inspect rear seats')
  `);

  // 13. Audit Log Initial Event
  db.run(`
    INSERT OR IGNORE INTO audit_logs (id, actor_user_id, actor_role, action, entity_type, entity_id, new_values, ip_address, user_agent)
    VALUES ('aud_init', 'usr_admin', 'SUPER_ADMIN', 'SYSTEM_INITIALIZED', 'PLATFORM', 'aditiride_v1', '{"version": "1.0", "status": "READY"}', '127.0.0.1', 'Antigravity Kernel')
  `);

  console.log('AditiRide platform seed complete.');
}

export function seedFeatureFlags(db: Database) {
  const flags = [
    { key: 'instant_ride', maturity: 'PRODUCTION_CERTIFIED', desc: 'Instant on-demand booking engine' },
    { key: 'driver_pricing', maturity: 'PRODUCTION_CERTIFIED', desc: 'Allow drivers to configure bounded custom fares' },
    { key: 'driver_offer_bidding', maturity: 'PRODUCTION_CERTIFIED', desc: 'Enable driver bidding and quotes for outstation' },
    { key: 'favorite_drivers', maturity: 'PRODUCTION_CERTIFIED', desc: 'Enable marking drivers as favorite & bilateral blocking' },
    { key: 'favorite_direct_requests', maturity: 'PRODUCTION_CERTIFIED', desc: 'Direct booking dispatch to favorite drivers' },
    { key: 'scheduled_rides', maturity: 'PRODUCTION_CERTIFIED', desc: 'Allow booking rides for future dates & times' },
    { key: 'recurring_commute', maturity: 'PRODUCTION_CERTIFIED', desc: 'Weekly/daily repeating commuter rides with date skipping' },
    { key: 'voice_booking', maturity: 'PRODUCTION_CERTIFIED', desc: 'Multi-lingual voice booking engine' },
    { key: 'cash_payments', maturity: 'PRODUCTION_CERTIFIED', desc: 'Allow cash settlement upon trip completion' },
    { key: 'wallet', maturity: 'PRODUCTION_CERTIFIED', desc: 'In-app AditiRide wallet balance and credits' },
    { key: 'dynamic_pricing', maturity: 'PRODUCTION_CERTIFIED', desc: 'Automatic surge pricing based on demand & zones' },
    { key: 'multi_stop', maturity: 'PRODUCTION_CERTIFIED', desc: 'Multi-stop rides with dynamic waiting calculation' },
    { key: 'lost_and_found', maturity: 'PRODUCTION_CERTIFIED', desc: 'Lost & Found Operations Desk with return reward' },
    { key: 'loyalty_passes', maturity: 'PRODUCTION_CERTIFIED', desc: 'VIP loyalty tiers and commuter ride passes' },
    { key: 'driver_kyc', maturity: 'PRODUCTION_CERTIFIED', desc: 'Driver compliance document verification' },
    { key: 'route_anomaly_detection', maturity: 'END_TO_END', desc: 'Real-time safety route deviation alerts' },
    { key: 'fleet_portal', maturity: 'PRODUCTION_CERTIFIED', desc: 'Fleet operator and multi-vehicle dispatch' },
    { key: 'rentals', maturity: 'UI_ONLY', desc: 'Hourly rental packages' },
    { key: 'outstation', maturity: 'UI_ONLY', desc: 'City-to-city outstation one-way & round-trip' },
    { key: 'accessible_service', maturity: 'BACKEND_PARTIAL', desc: 'Wheelchair & assisted mobility filters' },
    { key: 'pet_friendly', maturity: 'BACKEND_PARTIAL', desc: 'Pet-friendly vehicle filters' },
    { key: 'women_preference', maturity: 'BACKEND_PARTIAL', desc: 'Women-driver preference options' },
    { key: 'corporate_accounts', maturity: 'NOT_IMPLEMENTED', desc: 'Enterprise billing & employee cost centers' },
    { key: 'audio_safety_recording', maturity: 'NOT_IMPLEMENTED', desc: 'Encrypted in-trip safety audio recording' }
  ];
  for (const f of flags) {
    db.run(`INSERT OR REPLACE INTO feature_flags (key, enabled, maturity, description) VALUES (?, 1, ?, ?)`, [f.key, f.maturity, f.desc]);
  }
}
