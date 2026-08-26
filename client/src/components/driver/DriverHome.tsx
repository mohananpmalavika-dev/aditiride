import React, { useState, useEffect } from 'react';
import { User, LanguageCode, Booking } from '../../types/index.js';
import { api } from '../../services/api.js';
import { getSocket } from '../../services/socket.js';
import { t } from '../../i18n/translations.js';
import { OpenStreetMap } from '../common/OpenStreetMap.js';
import {
  Power,
  CheckCircle,
  X,
  Navigation,
  MapPin,
  Clock,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  Lock,
  Phone,
  MessageSquare,
  AlertTriangle,
  Sliders,
  FileCheck
} from 'lucide-react';

interface DriverHomeProps {
  currentUser: User;
  language: LanguageCode;
}

export const DriverHome: React.FC<DriverHomeProps> = ({ currentUser, language }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [activeTrip, setActiveTrip] = useState<Booking | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<any | null>(null);
  const [offerCountdown, setOfferCountdown] = useState(20);

  // OTP Verification for Trip Start
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');

  // Driver Custom Pricing Studio
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [customPerKm, setCustomPerKm] = useState(22.0);
  const [customBaseFare, setCustomBaseFare] = useState(85.0);
  const [pricingValidation, setPricingValidation] = useState<any>({ valid: true });

  // Earnings
  const [earnings, setEarnings] = useState<{ todayEarnings: number; totalGrossFare: number; totalCommissionPaid: number; history: any[] }>({
    todayEarnings: 2450,
    totalGrossFare: 2900,
    totalCommissionPaid: 450,
    history: []
  });

  const socket = getSocket();

  const loadDriverData = async () => {
    try {
      const authRes = await api.login(currentUser.id);
      setDriverProfile(authRes.roleData);

      if (authRes.roleData) {
        setIsOnline(authRes.roleData.availability_status === 'ONLINE');
        const earnRes = await api.getDriverEarnings(authRes.roleData.id);
        setEarnings(earnRes);

        const pricingRes = await api.getDriverPricing(authRes.roleData.id);
        if (pricingRes.pricing?.length > 0) {
          setCustomPerKm(pricingRes.pricing[0].custom_per_km);
          setCustomBaseFare(pricingRes.pricing[0].custom_base_fare);
        }
      }

      const activeRes = await api.getActiveBooking(currentUser.id, 'DRIVER');
      setActiveTrip(activeRes.activeBooking);
    } catch (err) {
      console.error('Error loading driver dashboard:', err);
    }
  };

  useEffect(() => {
    loadDriverData();

    // Listen for incoming ride offers or admin broadcasts
    socket.on('incoming_ride_offer', (data: any) => {
      setIncomingOffer(data);
      setOfferCountdown(20);
    });

    const interval = setInterval(loadDriverData, 6000);
    return () => {
      clearInterval(interval);
      socket.off('incoming_ride_offer');
    };
  }, [currentUser.id]);

  // Countdown timer for incoming request
  useEffect(() => {
    if (!incomingOffer) return;
    const timer = setInterval(() => {
      setOfferCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIncomingOffer(null);
          return 20;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [incomingOffer]);

  const handleToggleOnline = async () => {
    const nextStatus = isOnline ? 'OFFLINE' : 'ONLINE';
    try {
      if (driverProfile) {
        await api.setDriverStatus(driverProfile.id, nextStatus);
        setIsOnline(!isOnline);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAcceptOffer = async () => {
    if (!incomingOffer) return;
    try {
      await api.transitionBooking(incomingOffer.id, {
        status: 'DRIVER_ACCEPTED',
        triggeredByUserId: currentUser.id,
        driverId: driverProfile.id
      });
      setIncomingOffer(null);
      loadDriverData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStartTripWithOtp = async () => {
    if (!activeTrip) return;
    setOtpError('');
    try {
      await api.transitionBooking(activeTrip.id, {
        status: 'TRIP_STARTED',
        triggeredByUserId: currentUser.id,
        otp: otpInput
      });
      setOtpInput('');
      loadDriverData();
    } catch (err: any) {
      setOtpError(err.message);
    }
  };

  const handleArriveAtPickup = async () => {
    if (!activeTrip) return;
    try {
      await api.transitionBooking(activeTrip.id, {
        status: 'DRIVER_ARRIVED',
        triggeredByUserId: currentUser.id
      });
      loadDriverData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCompleteTrip = async () => {
    if (!activeTrip) return;
    try {
      await api.transitionBooking(activeTrip.id, {
        status: 'COMPLETED',
        triggeredByUserId: currentUser.id
      });
      loadDriverData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveCustomPricing = async () => {
    if (!driverProfile) return;
    try {
      await api.updateDriverPricing({
        driverId: driverProfile.id,
        vehicleCategoryId: driverProfile.vehicle_category_id || 'cat_sedan',
        customBaseFare,
        customPerKm,
        customPerMinute: 3.0,
        customWaitingRate: 3.0,
        customMinimumFare: 130.0
      });
      alert('Custom pricing updated and published within admin bounds!');
      setShowPricingModal(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 space-y-5">
      
      {/* Top Driver HUD & Online Switch */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <img
            src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'}
            alt={currentUser.name}
            className="w-16 h-16 rounded-2xl object-cover ring-2 ring-brand-500 shadow-md"
          />
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">{currentUser.name}</h2>
              <span className="flex items-center text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Verified Captain
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              ⭐ {driverProfile?.rating_avg || '4.95'} Rating • {driverProfile?.total_trips || '84'} Lifetime Trips • {driverProfile?.vehicle_plate || 'KL-08-BW-7777'}
            </p>
          </div>
        </div>

        {/* Big Online Toggle Switch */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowPricingModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
          >
            <Sliders className="w-4 h-4 text-brand-600" />
            <span>{t('driver_pricing', language)}</span>
          </button>

          <button
            onClick={handleToggleOnline}
            className={`flex items-center space-x-2 px-5 py-3 rounded-2xl font-extrabold text-sm shadow-lg transition-all ${
              isOnline
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                : 'bg-slate-700 hover:bg-slate-800 text-white'
            }`}
          >
            <Power className="w-5 h-5" />
            <span>{isOnline ? t('go_offline', language) : t('go_online', language)}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: Earnings & Acceptance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('earnings_today', language)}</p>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">₹{earnings.todayEarnings}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Net take-home payout</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gross Bookings</p>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">₹{earnings.totalGrossFare}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Platform fee: ₹{earnings.totalCommissionPaid}</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Acceptance Rate</p>
          <p className="text-2xl font-extrabold text-brand-600 dark:text-brand-400 mt-1">
            {((driverProfile?.acceptance_rate || 0.96) * 100).toFixed(0)}%
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Top 5% in Central Kerala</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Custom Rate</p>
          <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">₹{customPerKm}/km</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Admin range: ₹16–₹24/km</p>
        </div>
      </div>

      {/* Main Operations Split: Active Trip HUD or Telematics Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Action Column */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* Active Trip Execution HUD */}
          {activeTrip ? (
            <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-lg border-2 border-brand-500 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-100 text-brand-800 uppercase tracking-wider">
                    {activeTrip.status.replace(/_/g, ' ')}
                  </span>
                  <p className="text-xs font-mono font-bold text-slate-400 mt-1">#{activeTrip.booking_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Total Fare</p>
                  <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">₹{activeTrip.fare_estimate}</p>
                </div>
              </div>

              {/* Passenger Details */}
              <div className="flex items-center space-x-3.5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl">
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100"
                  className="w-12 h-12 rounded-full object-cover ring-1 ring-brand-500"
                />
                <div className="flex-1 truncate">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{activeTrip.passenger_name}</h4>
                  <p className="text-xs text-slate-500">⭐ {activeTrip.passenger_rating || '4.95'} • {activeTrip.passenger_phone || '+91 9447123456'}</p>
                </div>
              </div>

              {/* Route Endpoints */}
              <div className="space-y-2 text-xs">
                <div className="flex items-start space-x-2">
                  <span className="text-emerald-500 font-bold mt-0.5">●</span>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Pickup</p>
                    <p className="text-slate-500">{activeTrip.pickup_address}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-rose-500 font-bold mt-0.5">■</span>
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Destination</p>
                    <p className="text-slate-500">{activeTrip.destination_address}</p>
                  </div>
                </div>
              </div>

              {/* Lifecycle Stage Controls */}
              {activeTrip.status === 'DRIVER_ACCEPTED' || activeTrip.status === 'DRIVER_EN_ROUTE' ? (
                <button
                  onClick={handleArriveAtPickup}
                  className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold text-sm shadow-md"
                >
                  📍 I Have Arrived at Pickup
                </button>
              ) : activeTrip.status === 'DRIVER_ARRIVED' ? (
                <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center space-x-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                    <Lock className="w-4 h-4" />
                    <span>Enter 4-Digit Passenger OTP</span>
                  </div>
                  <input
                    type="text"
                    maxLength={4}
                    value={otpInput}
                    onChange={e => setOtpInput(e.target.value)}
                    placeholder="e.g. 5821"
                    className="w-full text-center text-2xl font-mono font-extrabold tracking-widest py-2 bg-white dark:bg-slate-900 rounded-xl border border-amber-300 dark:border-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  {otpError && <p className="text-[11px] font-bold text-rose-600">{otpError}</p>}
                  <button
                    onClick={handleStartTripWithOtp}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md"
                  >
                    🚀 Verify OTP & Start Trip
                  </button>
                </div>
              ) : activeTrip.status === 'TRIP_STARTED' || activeTrip.status === 'TRIP_IN_PROGRESS' ? (
                <button
                  onClick={handleCompleteTrip}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-extrabold text-sm shadow-xl shadow-emerald-600/30"
                >
                  🏁 Arrived at Destination • Complete Trip (Collect ₹{activeTrip.fare_estimate})
                </button>
              ) : null}

            </div>
          ) : (
            <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-brand-50 dark:bg-brand-950/60 text-brand-600 flex items-center justify-center mx-auto">
                <Navigation className="w-8 h-8 animate-spin" />
              </div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                {isOnline ? 'Waiting for New Ride Requests' : 'You are currently Offline'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {isOnline
                  ? 'Your GPS location is live. When a passenger books nearby, you will receive a direct booking offer.'
                  : 'Turn on the Online switch at the top to start receiving passenger bookings.'}
              </p>
            </div>
          )}

        </div>

        {/* Right Live Navigation Map */}
        <div className="lg:col-span-6 h-[500px] lg:h-[650px] rounded-3xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 relative">
          <OpenStreetMap
            center={{ lat: 10.5276, lng: 76.2144 }}
            pickup={activeTrip ? { lat: activeTrip.pickup_lat, lng: activeTrip.pickup_lng, address: activeTrip.pickup_address } : undefined}
            destination={activeTrip ? { lat: activeTrip.destination_lat, lng: activeTrip.destination_lng, address: activeTrip.destination_address } : undefined}
            activeDriver={{
              lat: 10.5276,
              lng: 76.2144,
              heading: 45,
              name: currentUser.name
            }}
            className="w-full h-full"
          />
        </div>

      </div>

      {/* Incoming Ride Request Modal (with 20s Countdown) */}
      {incomingOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in zoom-in-95">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border-2 border-brand-500 space-y-4 text-center">
            
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-40"></span>
              <div className="relative w-16 h-16 rounded-full bg-brand-600 text-white flex items-center justify-center text-xl font-extrabold shadow-lg">
                {offerCountdown}s
              </div>
            </div>

            <div>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-brand-100 text-brand-800">
                New Ride Offer
              </span>
              <h3 className="font-extrabold text-2xl text-slate-900 dark:text-white mt-1">₹{incomingOffer.fare_estimate}</h3>
              <p className="text-xs text-slate-500 font-medium">Estimated payout after commission</p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl text-left space-y-2 text-xs">
              <div className="flex items-start space-x-2">
                <span className="text-emerald-500 font-bold">●</span>
                <span className="truncate"><b>Pickup:</b> {incomingOffer.pickup_address}</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-rose-500 font-bold">■</span>
                <span className="truncate"><b>Drop:</b> {incomingOffer.destination_address}</span>
              </div>
              <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                Distance: {incomingOffer.distance_km} km • ETA: {incomingOffer.duration_min} mins
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setIncomingOffer(null)}
                className="py-3 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 rounded-2xl font-bold text-xs text-slate-700 dark:text-slate-300"
              >
                {t('decline_request', language)}
              </button>

              <button
                onClick={handleAcceptOffer}
                className="py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-extrabold text-sm shadow-lg shadow-brand-500/30"
              >
                {t('accept_request', language)}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Driver Custom Pricing Studio Modal */}
      {showPricingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Custom Pricing Studio</h3>
              <button onClick={() => setShowPricingModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Configure your desired rates. The platform enforces admin guardrails (±20% maximum deviation) to prevent unfair pricing.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Per KM Rate</span>
                  <span className="text-purple-600 font-extrabold">₹{customPerKm}/km</span>
                </div>
                <input
                  type="range"
                  min={16.0}
                  max={24.0}
                  step={0.5}
                  value={customPerKm}
                  onChange={e => setCustomPerKm(parseFloat(e.target.value))}
                  className="w-full accent-purple-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>Min: ₹16.0/km</span>
                  <span>Admin Ref: ₹20.0/km</span>
                  <span>Max: ₹24.0/km</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span>Base Pickup Fare</span>
                  <span className="text-purple-600 font-extrabold">₹{customBaseFare}</span>
                </div>
                <input
                  type="range"
                  min={70.0}
                  max={100.0}
                  step={5.0}
                  value={customBaseFare}
                  onChange={e => setCustomBaseFare(parseFloat(e.target.value))}
                  className="w-full accent-purple-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>Min: ₹70</span>
                  <span>Admin: ₹80</span>
                  <span>Max: ₹100</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveCustomPricing}
              className="w-full mt-4 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold text-sm shadow-md"
            >
              Save & Publish Rates
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
