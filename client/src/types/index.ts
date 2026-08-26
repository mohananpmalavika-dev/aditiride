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
  phone: string;
  email: string;
  name: string;
  role: UserRole;
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
}
