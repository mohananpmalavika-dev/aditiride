export type UserRole =
  | 'PASSENGER'
  | 'DRIVER'
  | 'FLEET_MANAGER'
  | 'ADMIN'
  | 'SUPER_ADMIN'
  | 'SUPPORT_AGENT'
  | 'SAFETY_AGENT'
  | 'PRICING_MANAGER';

export type DriverVerificationStatus =
  | 'PENDING'
  | 'DOCUMENT_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'BLOCKED';

export type DriverAvailability =
  | 'OFFLINE'
  | 'ONLINE'
  | 'BUSY'
  | 'ON_TRIP'
  | 'SCHEDULED';

export type BookingType =
  | 'INSTANT'
  | 'SCHEDULED'
  | 'RENTAL'
  | 'OUTSTATION';

export type BookingStatus =
  | 'CREATED'
  | 'SEARCHING'
  | 'OFFERED'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_ACCEPTED'
  | 'DRIVER_EN_ROUTE'
  | 'DRIVER_ARRIVED'
  | 'TRIP_STARTED'
  | 'TRIP_IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED_BY_PASSENGER'
  | 'CANCELLED_BY_DRIVER'
  | 'EXPIRED'
  | 'NO_DRIVER'
  | 'SAFETY_TERMINATED';

export type FareSource =
  | 'PLATFORM_COMMON'
  | 'DRIVER_CUSTOM'
  | 'DRIVER_OFFER'
  | 'ZONE_SURGE'
  | 'HYBRID_BOUNDED'
  | 'METER';

export type PaymentMethod =
  | 'CASH'
  | 'UPI'
  | 'CARD'
  | 'WALLET'
  | 'CORPORATE';

export type PaymentStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED';

export type DocType =
  | 'LICENSE'
  | 'RC'
  | 'INSURANCE'
  | 'PERMIT'
  | 'POLLUTION';

export type BlockType =
  | 'PASSENGER_TO_DRIVER'
  | 'DRIVER_TO_PASSENGER'
  | 'PAIR_SAFETY_SEPARATION'
  | 'ADMIN_ACCOUNT_BLOCK';

export type SOSStatus =
  | 'ACTIVE'
  | 'INVESTIGATING'
  | 'RESOLVED';

export type LanguageCode = 'en' | 'ml' | 'hi' | 'ta' | 'kn' | 'te';

export interface User {
  id: string;
  username?: string;
  phone: string;
  email: string;
  name: string;
  role: UserRole;
  password_hash: string;
  avatar_url?: string;
  emergency_contact?: string;
  preferred_language: LanguageCode;
  created_at: string;
  status: 'ACTIVE' | 'BLOCKED' | 'SUSPENDED';
}

export interface PassengerProfile {
  id: string;
  user_id: string;
  default_vehicle_category_id?: string;
  default_payment_method: PaymentMethod;
  wallet_balance: number;
  rating_avg: number;
  total_rides: number;
}

export interface DriverProfile {
  id: string;
  user_id: string;
  fleet_id?: string;
  verification_status: DriverVerificationStatus;
  availability_status: DriverAvailability;
  current_lat: number;
  current_lng: number;
  heading: number;
  last_location_update: string;
  rating_avg: number;
  acceptance_rate: number;
  cancellation_rate: number;
  total_trips: number;
  custom_fare_enabled: boolean;
  accepts_favorite_requests: boolean;
  accepts_scheduled_rides: boolean;
  accepts_airport_rides: boolean;
  accepts_outstation: boolean;
  accepts_cash: boolean;
  operating_zone?: string;
}

export interface Vehicle {
  id: string;
  driver_id: string;
  vehicle_category_id: string;
  vehicle_type: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  plate_number: string;
  seating_capacity: number;
  luggage_capacity: number;
  ac_enabled: boolean;
  is_ev: boolean;
  wheelchair_accessible: boolean;
  pet_friendly: boolean;
  child_seat_available: boolean;
  dashcam_equipped: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
}

export interface DriverDocument {
  id: string;
  driver_id: string;
  doc_type: DocType;
  doc_number: string;
  file_url: string;
  expiry_date: string;
  verification_status: DriverVerificationStatus;
  verified_by?: string;
  verified_at?: string;
  rejection_reason?: string;
}

export interface VehicleCategory {
  id: string;
  code: string;
  name: string;
  display_name: string;
  description: string;
  vehicle_class: 'TWO_WHEELER' | 'THREE_WHEELER' | 'CAR' | 'XL' | 'COMMERCIAL' | 'SPECIAL';
  passenger_capacity: number;
  luggage_capacity: number;
  base_fare: number;
  minimum_fare: number;
  per_km_rate: number;
  per_minute_rate: number;
  waiting_rate: number;
  booking_fee: number;
  platform_fee: number;
  tax_percent: number;
  commission_percent: number;
  cancellation_fee: number;
  night_charge_multiplier: number;
  surge_enabled: boolean;
  driver_custom_fare_allowed: boolean;
  max_deviation_percent: number; // e.g. 20 for +/-20%
  admin_fare_enabled: boolean;
  active: boolean;
  sort_order: number;
  icon: string;
  image: string;
}

export interface DriverPricing {
  id: string;
  driver_id: string;
  vehicle_category_id: string;
  custom_base_fare: number;
  custom_per_km: number;
  custom_per_minute: number;
  custom_waiting_rate: number;
  custom_minimum_fare: number;
  status: 'ACTIVE' | 'PENDING_APPROVAL' | 'REJECTED';
  approved_by_admin: boolean;
  effective_from: string;
  effective_until?: string;
}

export interface UserBlock {
  id: string;
  blocker_user_id: string;
  blocked_user_id: string;
  reason: string;
  block_type: BlockType;
  status: 'ACTIVE' | 'REVOKED';
  created_at: string;
  created_by: string;
}

export interface FavoriteDriver {
  id: string;
  passenger_id: string;
  driver_id: string;
  created_at: string;
  status: 'ACTIVE' | 'INACTIVE';
  driver_name?: string;
  driver_rating?: number;
  driver_avatar?: string;
  vehicle_model?: string;
  vehicle_plate?: string;
  vehicle_category_name?: string;
  is_online?: boolean;
}

export type FavoriteRelationship = FavoriteDriver;

export interface BookingStop {
  id: string;
  booking_id: string;
  stop_order: number;
  lat: number;
  lng: number;
  address: string;
  arrived_at?: string;
  completed_at?: string;
}

export interface Booking {
  id: string;
  booking_number: string;
  passenger_id: string;
  driver_id?: string;
  vehicle_id?: string;
  vehicle_category_id: string;
  booking_type: BookingType;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  destination_lat: number;
  destination_lng: number;
  destination_address: string;
  stops?: BookingStop[];
  scheduled_at?: string;
  distance_km: number;
  duration_min: number;
  otp_code: string;
  fare_estimate: number;
  final_fare?: number;
  fare_source: FareSource;
  fare_rule_version: string;
  surge_multiplier: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: BookingStatus;
  cancellation_reason?: string;
  cancellation_fee?: number;
  created_at: string;
  accepted_at?: string;
  arrived_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  // Joins
  passenger_name?: string;
  passenger_phone?: string;
  passenger_rating?: number;
  driver_name?: string;
  driver_phone?: string;
  driver_rating?: number;
  driver_avatar?: string;
  driver_lat?: number;
  driver_lng?: number;
  driver_heading?: number;
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  vehicle_plate?: string;
  vehicle_category_name?: string;
}

export interface FareQuote {
  id: string;
  booking_id?: string;
  vehicle_category_id: string;
  fare_rule_version: string;
  fare_source: FareSource;
  base_fare: number;
  distance_fare: number;
  time_fare: number;
  waiting_fare: number;
  booking_fee: number;
  surge_amount: number;
  surge_multiplier: number;
  tax_amount: number;
  discount_amount: number;
  total_fare: number;
  estimated_fare_min: number;
  estimated_fare_max: number;
  platform_commission: number;
  driver_payout: number;
  distance_km: number;
  duration_min: number;
  expires_at: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  user_id: string;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  gateway_transaction_id: string;
  idempotency_key: string;
  status: PaymentStatus;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  reference_type: 'RIDE_PAYMENT' | 'RIDE_EARNING' | 'COMMISSION' | 'TOPUP' | 'REFUND' | 'WITHDRAWAL';
  reference_id: string;
  description: string;
  created_at: string;
}

export interface DriverEarning {
  id: string;
  driver_id: string;
  booking_id: string;
  gross_fare: number;
  platform_commission: number;
  tax_deducted: number;
  net_earning: number;
  cash_collected: number;
  settlement_status: 'PENDING' | 'SETTLED' | 'HELD';
  created_at: string;
}

export interface ScheduledBooking {
  id: string;
  passenger_id: string;
  driver_preference: 'ANY' | 'FAVORITES' | 'SPECIFIC';
  specific_driver_id?: string;
  vehicle_category_id: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  destination_lat: number;
  destination_lng: number;
  destination_address: string;
  scheduled_time: string;
  recurrence_rule?: string; // e.g. "WEEKDAYS_8_30"
  status: 'PENDING' | 'REMINDER_SENT' | 'MATCHING' | 'ASSIGNED' | 'SPAWNED' | 'CANCELLED';
  flight_or_train_number?: string;
  created_at: string;
}

export interface SOSEvent {
  id: string;
  booking_id: string;
  triggered_by_user_id: string;
  lat: number;
  lng: number;
  status: SOSStatus;
  notes?: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_user_id: string;
  actor_role: UserRole;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values?: string;
  new_values?: string;
  reason_code?: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export interface Geofence {
  id: string;
  name: string;
  city: string;
  zone_type: 'CITY' | 'AIRPORT' | 'RAILWAY_STATION' | 'RESTRICTED' | 'HIGH_DEMAND';
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  surge_multiplier: number;
  surcharge_amount: number;
  active: boolean;
}

export interface ChatMessage {
  id: string;
  booking_id: string;
  sender_id: string;
  sender_role: 'PASSENGER' | 'DRIVER';
  message: string;
  created_at: string;
}

export interface RatingReview {
  id: string;
  booking_id: string;
  rater_id: string;
  rated_user_id: string;
  rating: number;
  tags: string[]; // e.g. ["Punctual", "Clean Car", "Smooth Driving", "Polite"]
  comment?: string;
  is_safety_report: boolean;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  booking_id?: string;
  category: 'FARE' | 'CANCELLATION' | 'LOST_ITEM' | 'SAFETY' | 'PAYMENT' | 'OTHER';
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  created_at: string;
  updated_at: string;
}
