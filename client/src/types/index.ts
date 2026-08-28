export type UserRole =
  | 'PASSENGER'
  | 'DRIVER'
  | 'FLEET_MANAGER'
  | 'ADMIN'
  | 'SUPER_ADMIN'
  | 'SUPPORT_AGENT'
  | 'SAFETY_AGENT';

export type LanguageCode = 'en' | 'ml' | 'hi' | 'ta' | 'kn' | 'te';

export interface User {
  id: string;
  phone?: string;
  email: string;
  name: string;
  role: UserRole;
  auth_provider?: 'LOCAL' | 'GOOGLE';
  google_id?: string;
  avatar_url?: string;
  emergency_contact?: string;
  preferred_language: LanguageCode;
  status: string;
}

export interface VehicleCategory {
  id: string;
  code: string;
  name: string;
  display_name: string;
  description: string;
  vehicle_class: string;
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
  surge_enabled: number | boolean;
  driver_custom_fare_allowed: number | boolean;
  max_deviation_percent: number;
  admin_fare_enabled: number | boolean;
  active: number | boolean;
  sort_order: number;
  icon: string;
  image: string;
}

export interface FareQuote {
  id: string;
  vehicle_category_id: string;
  fare_rule_version: string;
  fare_source: string;
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

export interface Booking {
  id: string;
  booking_number: string;
  passenger_id: string;
  driver_id?: string;
  vehicle_id?: string;
  vehicle_category_id: string;
  booking_type: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  destination_lat: number;
  destination_lng: number;
  destination_address: string;
  distance_km: number;
  duration_min: number;
  waiting_minutes?: number;
  waiting_fare?: number;
  waiting_rate?: number;
  waiting_status?: 'NONE' | 'WAITING' | 'PAUSED' | 'COMPLETED';
  waiting_started_at?: string;
  stop_address?: string;
  is_booking_for_other?: boolean | number;
  rider_name?: string;
  rider_phone?: string;
  rider_payment_mode?: 'BOOKER_PAYS' | 'RIDER_PAYS_CASH';
  recurring_series_id?: string;
  otp_code: string;
  fare_estimate: number;
  final_fare?: number;
  fare_source: string;
  surge_multiplier: number;
  payment_method: string;
  payment_status: string;
  status: string;
  cancellation_reason?: string;
  cancellation_fee?: number;
  created_at: string;
  accepted_at?: string;
  arrived_at?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  passenger_name?: string;
  passenger_phone?: string;
  passenger_rating?: number;
  driver_name?: string;
  driver_phone?: string;
  driver_avatar?: string;
  driver_lat?: number;
  driver_lng?: number;
  driver_heading?: number;
  driver_rating?: number;
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  vehicle_plate?: string;
  vehicle_category_name?: string;
}

export interface MatchedDriver {
  driverId: string;
  userId: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  ratingAvg: number;
  acceptanceRate: number;
  cancellationRate: number;
  totalTrips: number;
  currentLat: number;
  currentLng: number;
  heading: number;
  distanceToPickupKm: number;
  estimatedEtaMin: number;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  vehicleColor: string;
  vehicleCategoryId: string;
  isFavorite: boolean;
  score: number;
  freePickupKm?: number;
  pickupChargePerKm?: number;
  extraPickupKm?: number;
  pickupDistanceCharge?: number;
  driverTotalFare?: number;
  tripFare?: number;
}

export type ComplaintTargetType = 'DRIVER' | 'PASSENGER' | 'RIDE' | 'FARE' | 'SAFETY' | 'APP';
export type ComplaintSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ComplaintStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export interface Complaint {
  id: string;
  ticket_number: string;
  complainant_user_id: string;
  complainant_role: string;
  target_type: ComplaintTargetType;
  target_user_id?: string;
  target_user_name?: string;
  target_user_phone?: string;
  booking_id?: string;
  booking_number?: string;
  category: string;
  title: string;
  description: string;
  severity: ComplaintSeverity;
  status: ComplaintStatus;
  resolution_notes?: string;
  resolved_by?: string;
  resolved_by_name?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface RatingReview {
  id: string;
  booking_id: string;
  rater_id: string;
  rated_user_id: string;
  rating: number;
  tags: string[];
  comment?: string;
  is_safety_report: boolean;
  created_at: string;
}

export type LostItemCategory = 'PHONE' | 'BAG' | 'WALLET' | 'KEYS' | 'DOCUMENTS' | 'CLOTHING' | 'ELECTRONICS' | 'OTHER';
export type LostItemStatus = 'REPORTED' | 'DRIVER_NOTIFIED' | 'ITEM_FOUND' | 'RETURN_IN_PROGRESS' | 'RESOLVED' | 'CLOSED_NOT_FOUND';

export interface LostAndFoundItem {
  id: string;
  booking_id: string;
  booking_number?: string;
  passenger_id: string;
  passenger_name?: string;
  driver_id?: string;
  driver_name?: string;
  driver_phone?: string;
  item_category: LostItemCategory;
  item_description: string;
  contact_phone: string;
  return_fee: number;
  status: LostItemStatus;
  driver_notes?: string;
  created_at: string;
  resolved_at?: string;
}

export type RecurringSeriesStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED';

export interface RecurringRideSeries {
  id: string;
  passenger_id: string;
  vehicle_category_id: string;
  vehicle_category_name?: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  destination_lat: number;
  destination_lng: number;
  destination_address: string;
  pickup_time: string;
  days_of_week: string[];
  start_date: string;
  end_date: string;
  status: RecurringSeriesStatus;
  skipped_dates: string[];
  preferred_driver_id?: string;
  preferred_driver_name?: string;
  contracted_fare?: number;
  payment_method: string;
  created_at: string;
}

export interface RidePass {
  id: string;
  name: string;
  description: string;
  price: number;
  total_rides: number;
  discount_per_ride: number;
  vehicle_category_id?: string;
  vehicle_category_name?: string;
  validity_days: number;
  badge_color?: string;
  is_active: number | boolean;
  created_at: string;
}

export interface UserRidePass {
  id: string;
  user_id: string;
  pass_id: string;
  pass_name?: string;
  pass_description?: string;
  discount_per_ride?: number;
  rides_remaining: number;
  expires_at: string;
  status: 'ACTIVE' | 'EXPIRED' | 'EXHAUSTED';
  created_at: string;
}

export interface ReferralReward {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  referral_code: string;
  bonus_amount: number;
  status: 'PENDING' | 'CREDITED' | 'EXPIRED';
  credited_at?: string;
  created_at: string;
}

export type ComplianceDocType = 'DRIVING_LICENSE' | 'VEHICLE_RC' | 'INSURANCE' | 'POLICE_VERIFICATION' | 'PERMIT' | 'FITNESS';
export type ComplianceDocStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface DriverComplianceDocument {
  id: string;
  driver_id: string;
  driver_name?: string;
  driver_phone?: string;
  document_type: ComplianceDocType;
  document_number: string;
  document_url?: string;
  expiry_date?: string;
  verification_status: ComplianceDocStatus;
  rejection_reason?: string;
  verified_by?: string;
  verified_at?: string;
  created_at: string;
}

export interface DriverProfile {
  id: string;
  user_id: string;
  license_number?: string;
  vehicle_category_id?: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_plate?: string;
  rating_avg?: number;
  total_trips?: number;
  current_lat?: number;
  current_lng?: number;
  is_online?: number | boolean;
  status?: string;
}
