import { v4 as uuidv4 } from 'uuid';
import { get, query } from '../db/index.js';
import { VehicleCategory, DriverPricing, FareQuote, FareSource, Geofence } from '../types/index.js';

export interface FareCalculationInput {
  vehicleCategoryId: string;
  distanceKm: number;
  durationMin: number;
  waitingMinutes?: number;
  pickupLat?: number;
  pickupLng?: number;
  destLat?: number;
  destLng?: number;
  driverId?: string;
  driverDistanceToPickupKm?: number;
  isNightTime?: boolean;
  numberOfStops?: number;
  promoCode?: string;
  customDemandMultiplier?: number;
}

export class FareEngine {
  public static readonly VERSION = '1.0';

  /**
   * Calculate authoritative fare quote with itemized components, including driver-specific pickup distance policy
   */
  public static calculateFare(input: FareCalculationInput): FareQuote {
    const category = get<VehicleCategory>(
      'SELECT * FROM vehicle_categories WHERE id = ? AND active = 1',
      [input.vehicleCategoryId]
    );

    if (!category) {
      throw new Error(`Vehicle category ${input.vehicleCategoryId} not found or inactive`);
    }

    let fareSource: FareSource = 'PLATFORM_COMMON';
    let baseFare = category.base_fare;
    let perKm = category.per_km_rate;
    let perMin = category.per_minute_rate;
    let waitingRate = category.waiting_rate;
    let minFare = category.minimum_fare;
    let freePickupKm = 2.0;
    let pickupChargePerKm = 10.0;

    // Check if Driver Custom Pricing and Pickup Policy applies
    if (input.driverId) {
      const driverProfile = get<any>(
        'SELECT free_pickup_km, pickup_charge_per_km FROM driver_profiles WHERE id = ?',
        [input.driverId]
      );
      if (driverProfile) {
        if (driverProfile.free_pickup_km !== undefined && driverProfile.free_pickup_km !== null) {
          freePickupKm = Number(driverProfile.free_pickup_km);
        }
        if (driverProfile.pickup_charge_per_km !== undefined && driverProfile.pickup_charge_per_km !== null) {
          pickupChargePerKm = Number(driverProfile.pickup_charge_per_km);
        }
      }

      if (category.driver_custom_fare_allowed) {
        const driverPricing = get<any>(
          'SELECT * FROM driver_pricing WHERE driver_id = ? AND vehicle_category_id = ? AND status = "ACTIVE"',
          [input.driverId, input.vehicleCategoryId]
        );

        if (driverPricing && driverPricing.approved_by_admin) {
          // Enforce admin min/max deviation guardrails
          const maxDev = (category.max_deviation_percent || 20.0) / 100.0;
          const minAllowedKm = category.per_km_rate * (1 - maxDev);
          const maxAllowedKm = category.per_km_rate * (1 + maxDev);

          const clampedPerKm = Math.min(Math.max(driverPricing.custom_per_km, minAllowedKm), maxAllowedKm);
          
          baseFare = driverPricing.custom_base_fare || category.base_fare;
          perKm = clampedPerKm;
          perMin = driverPricing.custom_per_minute || category.per_minute_rate;
          waitingRate = driverPricing.custom_waiting_rate || category.waiting_rate;
          minFare = driverPricing.custom_minimum_fare || category.minimum_fare;
          if (driverPricing.free_pickup_km !== undefined && driverPricing.free_pickup_km !== null) {
            freePickupKm = Number(driverPricing.free_pickup_km);
          }
          if (driverPricing.pickup_charge_per_km !== undefined && driverPricing.pickup_charge_per_km !== null) {
            pickupChargePerKm = Number(driverPricing.pickup_charge_per_km);
          }
          fareSource = 'DRIVER_CUSTOM';
        }
      }
    }

    // Calculate Driver Pickup Surcharge (if driver distance to pickup > freePickupKm)
    let pickupDistanceCharge = 0.0;
    if (input.driverDistanceToPickupKm !== undefined && input.driverDistanceToPickupKm > freePickupKm) {
      const extraKm = input.driverDistanceToPickupKm - freePickupKm;
      pickupDistanceCharge = Math.round(extraKm * pickupChargePerKm * 100) / 100;
    }

    // Geofence & Zone Surcharges (e.g. Airport fee, Swaraj round surge)
    let zoneSurcharge = 0.0;
    let zoneSurgeMultiplier = 1.0;
    if (input.pickupLat && input.pickupLng) {
      const activeGeofences = query<Geofence>('SELECT * FROM geofences WHERE active = 1');
      for (const geo of activeGeofences) {
        const dist = this.haversineDistance(input.pickupLat, input.pickupLng, geo.center_lat, geo.center_lng);
        if (dist <= geo.radius_meters / 1000.0) {
          zoneSurcharge += geo.surcharge_amount || 0;
          if (geo.surge_multiplier > zoneSurgeMultiplier) {
            zoneSurgeMultiplier = geo.surge_multiplier;
            if (fareSource === 'PLATFORM_COMMON') {
              fareSource = 'ZONE_SURGE';
            }
          }
        }
      }
    }

    // Surge Multiplier Calculation
    let surgeMultiplier = 1.0;
    if (category.surge_enabled) {
      surgeMultiplier = Math.max(zoneSurgeMultiplier, input.customDemandMultiplier || 1.0);
      if (input.isNightTime) {
        surgeMultiplier *= (category.night_charge_multiplier || 1.0);
      }
    }

    // Distance & Time Fares
    const distanceFare = Math.round(input.distanceKm * perKm * 100) / 100;
    const timeFare = Math.round(input.durationMin * perMin * 100) / 100;
    const waitingFare = Math.round((input.waitingMinutes || 0) * waitingRate * 100) / 100;
    const bookingFee = category.booking_fee + category.platform_fee + zoneSurcharge;

    // Multi-stop Surcharge (e.g. ₹20 per intermediate stop)
    const multiStopFee = (input.numberOfStops && input.numberOfStops > 0) ? input.numberOfStops * 20.0 : 0.0;

    // Pre-Tax Subtotal
    const calculatedPreTax = (baseFare + distanceFare + timeFare + waitingFare + multiStopFee) * surgeMultiplier + bookingFee;
    const surgeAmount = Math.max(0, Math.round(((baseFare + distanceFare + timeFare) * (surgeMultiplier - 1.0)) * 100) / 100);

    // Apply Minimum Fare Guard
    const subtotal = Math.max(calculatedPreTax, minFare);

    // Taxes (e.g. 5% GST)
    const taxAmount = Math.round((subtotal * (category.tax_percent / 100.0)) * 100) / 100;

    // Promo Discount
    let discountAmount = 0.0;
    if (input.promoCode) {
      if (input.promoCode.toUpperCase() === 'FIRST50') {
        discountAmount = Math.min(50.0, subtotal * 0.5);
      } else if (input.promoCode.toUpperCase() === 'ADITI20') {
        discountAmount = Math.min(100.0, subtotal * 0.2);
      }
    }

    const tripFare = Math.max(minFare, Math.round((subtotal + taxAmount - discountAmount) * 100) / 100);
    const totalFare = Math.round((tripFare + pickupDistanceCharge) * 100) / 100;

    // Commission & Driver Payout
    const commissionableFare = tripFare - taxAmount - category.booking_fee;
    const platformCommission = Math.round(((commissionableFare * (category.commission_percent / 100.0)) + category.booking_fee) * 100) / 100;
    const driverPayout = Math.max(0, Math.round((totalFare - platformCommission - taxAmount) * 100) / 100);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10 min quote TTL

    return {
      id: `fq_${uuidv4().substring(0, 8)}`,
      vehicle_category_id: category.id,
      fare_rule_version: this.VERSION,
      fare_source: fareSource,
      base_fare: baseFare,
      distance_fare: distanceFare,
      time_fare: timeFare,
      waiting_fare: waitingFare,
      booking_fee: bookingFee,
      surge_amount: surgeAmount,
      surge_multiplier: surgeMultiplier,
      tax_amount: taxAmount,
      discount_amount: discountAmount,
      pickup_distance_charge: pickupDistanceCharge,
      driver_free_pickup_km: freePickupKm,
      driver_pickup_distance_km: input.driverDistanceToPickupKm,
      total_fare: totalFare,
      estimated_fare_min: Math.floor(totalFare * 0.95),
      estimated_fare_max: Math.ceil(totalFare * 1.08),
      platform_commission: platformCommission,
      driver_payout: driverPayout,
      distance_km: input.distanceKm,
      duration_min: input.durationMin,
      expires_at: expiresAt
    };
  }

  /**
   * Calculate fare estimates across all active categories in a single call
   */
  public static calculateMultiCategoryEstimates(
    distanceKm: number,
    durationMin: number,
    pickupLat?: number,
    pickupLng?: number,
    driverId?: string
  ): Record<string, FareQuote> {
    const categories = query<VehicleCategory>('SELECT * FROM vehicle_categories WHERE active = 1 ORDER BY sort_order ASC');
    const quotes: Record<string, FareQuote> = {};

    for (const cat of categories) {
      try {
        quotes[cat.id] = this.calculateFare({
          vehicleCategoryId: cat.id,
          distanceKm,
          durationMin,
          pickupLat,
          pickupLng,
          driverId
        });
      } catch (e) {}
    }

    return quotes;
  }

  /**
   * Validate driver custom pricing against admin allowable bounds
   */
  public static validateDriverPricing(categoryId: string, customPerKm: number, customBaseFare?: number): { valid: boolean; minAllowed: number; maxAllowed: number; message?: string } {
    const category = get<VehicleCategory>('SELECT * FROM vehicle_categories WHERE id = ?', [categoryId]);
    if (!category) {
      return { valid: false, minAllowed: 0, maxAllowed: 0, message: 'Invalid category' };
    }

    const maxDev = (category.max_deviation_percent || 20.0) / 100.0;
    const minAllowed = Math.round(category.per_km_rate * (1 - maxDev) * 10) / 10;
    const maxAllowed = Math.round(category.per_km_rate * (1 + maxDev) * 10) / 10;

    if (customPerKm < minAllowed || customPerKm > maxAllowed) {
      return {
        valid: false,
        minAllowed,
        maxAllowed,
        message: `Custom per-km rate must be between ₹${minAllowed} and ₹${maxAllowed} (Admin limit ±${category.max_deviation_percent}%)`
      };
    }

    return { valid: true, minAllowed, maxAllowed };
  }

  private static haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
