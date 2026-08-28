import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().min(3, 'Username, email or phone number is required'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^\+?[0-9]{10,14}$/, 'Valid phone number is required'),
  email: z.string().email('Valid email is required').optional(),
  username: z.string().min(3, 'Username must be at least 3 characters').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['PASSENGER', 'DRIVER', 'FLEET_MANAGER']).default('PASSENGER'),
  preferredLanguage: z.enum(['en', 'ml', 'hi', 'ta', 'kn', 'te']).default('en'),
  vehicleCategoryId: z.string().optional(),
  vehicleBrand: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehiclePlate: z.string().optional()
});

export const createBookingSchema = z.object({
  vehicleCategoryId: z.string().min(1, 'Vehicle category is required'),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  pickupAddress: z.string().min(3, 'Pickup address is required'),
  destinationLat: z.number().min(-90).max(90),
  destinationLng: z.number().min(-180).max(180),
  destinationAddress: z.string().min(3, 'Destination address is required'),
  bookingType: z.enum(['INSTANT', 'SCHEDULED', 'OUTSTATION', 'RENTAL', 'TOUR_PACKAGE', 'PARCEL_DELIVERY']).default('INSTANT'),
  paymentMethod: z.enum(['UPI', 'CASH', 'WALLET', 'CARD']).default('UPI'),
  scheduledAt: z.string().optional(),
  preferredDriverId: z.string().optional(),
  stops: z.array(z.object({
    lat: z.number(),
    lng: z.number(),
    address: z.string()
  })).optional(),
  isBookingForOther: z.boolean().optional(),
  riderName: z.string().optional(),
  riderPhone: z.string().optional(),
  riderPaymentMode: z.enum(['BOOKER_PAYS', 'RIDER_PAYS_CASH']).optional(),
  recurringSeriesId: z.string().optional(),
  stopAddress: z.string().optional(),
  waitingMinutes: z.number().optional()
});

export const rateBookingSchema = z.object({
  rating: z.number().min(1).max(5),
  tags: z.array(z.string()).optional(),
  comment: z.string().max(500).optional(),
  isSafetyReport: z.boolean().optional()
});

export const sosSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  notes: z.string().max(500).optional()
});

export const driverPricingSchema = z.object({
  vehicleCategoryId: z.string().min(1),
  customBaseFare: z.number().min(10),
  customPerKm: z.number().min(5),
  customPerMinute: z.number().min(0),
  customWaitingRate: z.number().min(0),
  customMinimumFare: z.number().min(10)
});
