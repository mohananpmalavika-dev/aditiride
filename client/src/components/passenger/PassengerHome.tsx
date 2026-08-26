import React, { useState, useEffect } from 'react';
import { User, VehicleCategory, FareQuote, MatchedDriver, LanguageCode } from '../../types/index.js';
import { api } from '../../services/api.js';
import { t } from '../../i18n/translations.js';
import { OpenStreetMap } from '../common/OpenStreetMap.js';
import { VoiceBookingModal } from './VoiceBookingModal.js';
import {
  Search,
  Mic,
  Navigation,
  MapPin,
  Car,
  Clock,
  Heart,
  Plus,
  Trash2,
  Sparkles,
  CreditCard,
  Wallet,
  ArrowRight,
  ShieldCheck,
  Zap,
  RotateCcw
} from 'lucide-react';

interface PassengerHomeProps {
  currentUser: User;
  language: LanguageCode;
  onBookingCreated: (bookingId: string) => void;
}

export const PassengerHome: React.FC<PassengerHomeProps> = ({
  currentUser,
  language,
  onBookingCreated
}) => {
  const [pickupAddress, setPickupAddress] = useState('Swaraj Round, Thrissur');
  const [pickupCoords, setPickupCoords] = useState({ lat: 10.5276, lng: 76.2144 });

  const [destinationSearch, setDestinationSearch] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('Lulu International Shopping Mall Thrissur');
  const [destCoords, setDestCoords] = useState({ lat: 10.5360, lng: 76.2220 });

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Multi-stop trips
  const [stops, setStops] = useState<{ lat: number; lng: number; address: string }[]>([]);

  // Categories & Quotes
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('cat_auto');
  const [quotes, setQuotes] = useState<Record<string, FareQuote>>({});
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [distanceKm, setDistanceKm] = useState(4.2);
  const [durationMin, setDurationMin] = useState(14);

  // Driver & Payment Preferences
  const [driverPreference, setDriverPreference] = useState<'ANY' | 'FAVORITES' | 'SPECIFIC'>('ANY');
  const [favoriteDrivers, setFavoriteDrivers] = useState<any[]>([]);
  const [selectedFavoriteDriverId, setSelectedFavoriteDriverId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'WALLET' | 'CASH' | 'CARD'>('UPI');

  // Nearby Drivers
  const [nearbyDrivers, setNearbyDrivers] = useState<MatchedDriver[]>([]);

  // Recent Trips for 1-Tap Rebook
  const [recentTrips, setRecentTrips] = useState<any[]>([]);

  // Modals & Submitting
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load initial data
  useEffect(() => {
    api.getCategories().then(res => {
      setCategories(res.categories || []);
      if (res.categories?.length > 0) setSelectedCategory(res.categories[0].id);
    });

    api.getFavoriteDrivers(currentUser.id).then(res => {
      setFavoriteDrivers(res.favorites || []);
      if (res.favorites?.length > 0) setSelectedFavoriteDriverId(res.favorites[0].driver_id);
    });

    api.getRecentBookings(currentUser.id).then(res => {
      setRecentTrips(res.recent || []);
    });

    // Auto-detect current geolocation if available
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setPickupCoords({ lat, lng });
          api.reverseGeocode(lat, lng).then(r => setPickupAddress(r.address)).catch(() => {});
        },
        () => console.log('Using default Kerala geolocation')
      );
    }
  }, [currentUser.id]);

  // Recalculate routes and quotes on coordinate change
  useEffect(() => {
    const fetchFaresAndRoutes = async () => {
      try {
        const routeRes = await api.calculateRoute(pickupCoords, destCoords, stops);
        setRoutePolyline(routeRes.route.polyline);
        setDistanceKm(routeRes.route.distanceKm);
        setDurationMin(routeRes.route.durationMin);

        // Fetch quotes for all categories
        const newQuotes: Record<string, FareQuote> = {};
        for (const cat of categories) {
          const quoteRes = await api.estimateFare({
            vehicleCategoryId: cat.id,
            distanceKm: routeRes.route.distanceKm,
            durationMin: routeRes.route.durationMin,
            pickupLat: pickupCoords.lat,
            pickupLng: pickupCoords.lng,
            driverId: driverPreference === 'SPECIFIC' ? selectedFavoriteDriverId : undefined,
            numberOfStops: stops.length
          });
          newQuotes[cat.id] = quoteRes.quote;
        }
        setQuotes(newQuotes);

        // Fetch nearby drivers
        const matchRes = await api.getNearbyDrivers(
          pickupCoords.lat,
          pickupCoords.lng,
          selectedCategory,
          currentUser.id,
          driverPreference === 'SPECIFIC' ? selectedFavoriteDriverId : undefined
        );
        setNearbyDrivers(matchRes.drivers || []);
      } catch (err) {
        console.error('Fare recalculation error:', err);
      }
    };

    if (categories.length > 0) {
      fetchFaresAndRoutes();
    }
  }, [pickupCoords, destCoords, stops, categories, selectedCategory, driverPreference, selectedFavoriteDriverId]);

  const handleSearchLocations = async (text: string) => {
    setDestinationSearch(text);
    if (text.trim().length > 1) {
      setIsSearching(true);
      const res = await api.searchLocations(text);
      setSearchResults(res.locations || []);
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  };

  const handleSelectDestination = (loc: any) => {
    setDestinationAddress(loc.name + (loc.address ? ` (${loc.address})` : ''));
    setDestCoords({ lat: loc.lat, lng: loc.lng });
    setDestinationSearch('');
    setIsSearching(false);
  };

  const handleVoiceBookingConfirm = async (parsed: any) => {
    if (parsed.entities?.destinationLocation) {
      setDestinationAddress(parsed.entities.destinationLocation.name);
      setDestCoords({
        lat: parsed.entities.destinationLocation.lat,
        lng: parsed.entities.destinationLocation.lng
      });
    }

    if (parsed.entities?.vehicleCategoryId) {
      setSelectedCategory(parsed.entities.vehicleCategoryId);
    }

    if (parsed.entities?.paymentMethod) {
      setPaymentMethod(parsed.entities.paymentMethod);
    }

    // Trigger booking immediately
    setTimeout(() => {
      handleCreateBooking();
    }, 400);
  };

  const handleCreateBooking = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await api.createBooking({
        passengerId: currentUser.id,
        vehicleCategoryId: selectedCategory,
        pickupLat: pickupCoords.lat,
        pickupLng: pickupCoords.lng,
        pickupAddress,
        destinationLat: destCoords.lat,
        destinationLng: destCoords.lng,
        destinationAddress,
        preferredDriverId: driverPreference === 'SPECIFIC' ? selectedFavoriteDriverId : undefined,
        paymentMethod,
        stops
      });

      onBookingCreated(res.booking.id);
    } catch (err: any) {
      alert(err.message || 'Booking creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOneTapRebook = (pastTrip: any) => {
    setPickupAddress(pastTrip.pickup_address);
    setPickupCoords({ lat: pastTrip.pickup_lat, lng: pastTrip.pickup_lng });
    setDestinationAddress(pastTrip.destination_address);
    setDestCoords({ lat: pastTrip.destination_lat, lng: pastTrip.destination_lng });
    setSelectedCategory(pastTrip.vehicle_category_id);
    setPaymentMethod(pastTrip.payment_method || 'UPI');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Interactive Booking Panel */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* Welcome & Fast Voice Search Bar */}
          <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400">Welcome,</p>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {currentUser.name.split(' ')[0]} 👋
                </h2>
              </div>
              
              {/* Voice Booking Button */}
              <button
                onClick={() => setShowVoiceModal(true)}
                className="flex items-center space-x-2 px-3.5 py-2 bg-gradient-to-tr from-brand-600 to-emerald-500 hover:from-brand-700 hover:to-emerald-600 text-white rounded-2xl text-xs font-bold shadow-md shadow-brand-500/20 transition-all hover:scale-105 active:scale-95"
              >
                <Mic className="w-4 h-4 animate-pulse" />
                <span>{t('voice_booking', language)}</span>
              </button>
            </div>

            {/* Destination Search Box */}
            <div className="relative">
              <div className="flex items-center px-4 py-3 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 focus-within:ring-2 focus-within:ring-brand-500 transition-all">
                <Search className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
                <input
                  type="text"
                  value={destinationSearch}
                  onChange={e => handleSearchLocations(e.target.value)}
                  placeholder={destinationAddress || t('search_destination', language)}
                  className="w-full bg-transparent text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none"
                />
              </div>

              {/* Autocomplete Dropdown */}
              {isSearching && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-in fade-in slide-in-from-top-2">
                  {searchResults.map(loc => (
                    <button
                      key={loc.id}
                      onClick={() => handleSelectDestination(loc)}
                      className="w-full text-left px-4 py-2.5 hover:bg-brand-50 dark:hover:bg-brand-950/40 flex items-start space-x-3 transition-colors border-b border-slate-100 dark:border-slate-800/50 last:border-0"
                    >
                      <MapPin className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{loc.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{loc.address}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Landmark Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
              {[
                { name: 'Lulu Mall', lat: 10.5360, lng: 76.2220 },
                { name: 'Cochin Airport', lat: 10.1518, lng: 76.3930 },
                { name: 'Railway Station', lat: 10.5186, lng: 76.2085 },
                { name: 'Infopark', lat: 10.0125, lng: 76.3620 }
              ].map((loc, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectDestination({ name: loc.name, lat: loc.lat, lng: loc.lng, address: loc.name })}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/40 rounded-xl text-slate-700 dark:text-slate-300 font-semibold shrink-0 transition-colors text-[11px]"
                >
                  📍 {loc.name}
                </button>
              ))}
            </div>
          </div>

          {/* 1-Tap Quick Rebook Card (from Recent Trips) */}
          {recentTrips.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-brand-50 to-emerald-50 dark:from-brand-950/30 dark:to-emerald-950/20 rounded-3xl border border-brand-200/80 dark:border-brand-800/50 flex items-center justify-between shadow-sm">
              <div className="flex items-center space-x-3 truncate mr-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-bold shadow-md shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <span className="text-[10px] font-bold text-brand-700 dark:text-brand-300 uppercase tracking-wider">
                    Recent Route
                  </span>
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                    {recentTrips[0].pickup_address.split(',')[0]} → {recentTrips[0].destination_address.split(',')[0]}
                  </p>
                  <p className="text-[11px] text-slate-500">₹{recentTrips[0].final_fare || recentTrips[0].fare_estimate} • {recentTrips[0].vehicle_category_display || 'Auto'}</p>
                </div>
              </div>
              <button
                onClick={() => handleOneTapRebook(recentTrips[0])}
                className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm shrink-0 transition-transform active:scale-95"
              >
                {t('book_again', language)}
              </button>
            </div>
          )}

          {/* Vehicle Category Carousel & Real-Time Fare Cards */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Select Vehicle Category
              </h3>
              <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                {distanceKm} km • {durationMin} mins
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {categories.map(cat => {
                const quote = quotes[cat.id];
                const isSelected = selectedCategory === cat.id;

                return (
                  <div
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-brand-50/90 dark:bg-brand-950/40 border-brand-500 shadow-md ring-2 ring-brand-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-brand-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl shadow-inner shrink-0">
                        {cat.code === 'BIKE' ? '🏍️' : cat.code === 'AUTO' ? '🛺' : cat.code === 'MINI' ? '🚗' : cat.code === 'SEDAN' ? '🚘' : cat.code === 'SUV' ? '🚙' : '🚐'}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {cat.display_name}
                          </h4>
                          {cat.surge_enabled && quote && quote.surge_multiplier > 1.0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 rounded-md">
                              {quote.surge_multiplier}x Surge
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{cat.description}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {cat.passenger_capacity} seats • ~3 min away
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-base font-extrabold text-slate-900 dark:text-white">
                        ₹{quote ? quote.total_fare : cat.base_fare}
                      </p>
                      {quote && quote.fare_source === 'DRIVER_CUSTOM' && (
                        <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400">Driver Fare</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Driver Matching & Payment Options */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
            
            {/* Driver Preference Selector */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Driver Preference
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDriverPreference('ANY')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                    driverPreference === 'ANY'
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  ⚡ {t('any_nearby_driver', language)}
                </button>

                <button
                  onClick={() => setDriverPreference('SPECIFIC')}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                    driverPreference === 'SPECIFIC'
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  ⭐ {t('specific_favorite', language)}
                </button>
              </div>

              {/* Show Favorite Driver Selector if selected */}
              {driverPreference === 'SPECIFIC' && favoriteDrivers.length > 0 && (
                <div className="mt-2 p-2.5 bg-brand-50/70 dark:bg-brand-950/40 rounded-xl border border-brand-200 dark:border-brand-800/60 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                    <span className="font-bold text-slate-900 dark:text-white truncate">
                      {favoriteDrivers[0].driver_name} ({favoriteDrivers[0].vehicle_category_name})
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600">★ {favoriteDrivers[0].rating_avg}</span>
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                {t('pay_with', language)}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {['UPI', 'WALLET', 'CASH', 'CARD'].map(method => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method as any)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      paymentMethod === method
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {/* Confirm Booking Action Button (Double-tap protected) */}
            <button
              onClick={handleCreateBooking}
              disabled={isSubmitting}
              className="w-full mt-2 py-4 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white rounded-2xl font-extrabold text-base shadow-xl shadow-brand-500/25 transition-all flex items-center justify-center space-x-2 active:scale-98"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  <span>Matching Driver...</span>
                </>
              ) : (
                <>
                  <span>{t('book_now', language)} (₹{quotes[selectedCategory]?.total_fare || '---'})</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

        </div>

        {/* Right OpenStreetMap & Live Nearby Fleet Map */}
        <div className="lg:col-span-6 flex flex-col space-y-4">
          <div className="w-full h-[520px] lg:h-[740px] rounded-3xl overflow-hidden shadow-xl border border-slate-200 dark:border-slate-800 relative">
            <OpenStreetMap
              center={pickupCoords}
              pickup={{ lat: pickupCoords.lat, lng: pickupCoords.lng, address: pickupAddress }}
              destination={{ lat: destCoords.lat, lng: destCoords.lng, address: destinationAddress }}
              stops={stops}
              routePolyline={routePolyline}
              drivers={nearbyDrivers}
              className="w-full h-full"
            />

            {/* Floating Pickup Location Badge */}
            <div className="absolute top-4 left-4 z-[400] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 max-w-xs text-xs">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Pickup</p>
              <p className="font-bold text-slate-900 dark:text-white truncate">{pickupAddress}</p>
            </div>
          </div>
        </div>

      </div>

      {/* Voice Booking Modal */}
      <VoiceBookingModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        language={language}
        currentLat={pickupCoords.lat}
        currentLng={pickupCoords.lng}
        onConfirmBooking={handleVoiceBookingConfirm}
      />
    </div>
  );
};
