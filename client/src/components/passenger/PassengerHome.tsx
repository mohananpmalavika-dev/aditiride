import React, { useState, useEffect, useRef } from 'react';
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
  RotateCcw,
  Crosshair,
  ArrowUpDown,
  X
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
  // Pickup Location (Default: Current GPS Location)
  const [pickupAddress, setPickupAddress] = useState('📍 Current Location (Locating...)');
  const [pickupSearch, setPickupSearch] = useState('');
  const [pickupCoords, setPickupCoords] = useState({ lat: 10.5276, lng: 76.2144 });
  const [isLocatingGPS, setIsLocatingGPS] = useState(false);
  const [isEditingPickup, setIsEditingPickup] = useState(false);

  // Destination Location
  const [destinationSearch, setDestinationSearch] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('Lulu International Shopping Mall Thrissur');
  const [destCoords, setDestCoords] = useState({ lat: 10.5360, lng: 76.2220 });

  // Autocomplete Search
  const [activeSearchField, setActiveSearchField] = useState<'PICKUP' | 'DESTINATION' | null>(null);
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

  // Function to locate GPS current location
  const handleDetectCurrentLocation = () => {
    setIsLocatingGPS(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setPickupCoords({ lat, lng });
          try {
            const r = await api.reverseGeocode(lat, lng);
            setPickupAddress(r.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          } catch {
            setPickupAddress('📍 Current Location (GPS)');
          }
          setIsLocatingGPS(false);
          setIsEditingPickup(false);
        },
        err => {
          console.warn('Geolocation denied or error, using default Kerala location:', err);
          setPickupAddress('📍 Swaraj Round, Thrissur (Default)');
          setPickupCoords({ lat: 10.5276, lng: 76.2144 });
          setIsLocatingGPS(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setPickupAddress('📍 Swaraj Round, Thrissur');
      setIsLocatingGPS(false);
    }
  };

  // Load initial data & auto-locate on mount
  useEffect(() => {
    handleDetectCurrentLocation();

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
  }, [currentUser.id]);

  // Recalculate routes and quotes on coordinate change
  useEffect(() => {
    const fetchFaresAndRoutes = async () => {
      try {
        const routeRes = await api.calculateRoute(pickupCoords, destCoords, stops);
        if (routeRes.route) {
          setRoutePolyline(routeRes.route.polyline || []);
          setDistanceKm(routeRes.route.distanceKm || 4.2);
          setDurationMin(routeRes.route.durationMin || 14);
        }

        // Fetch quotes for all categories
        const newQuotes: Record<string, FareQuote> = {};
        for (const cat of categories) {
          const quoteRes = await api.estimateFare({
            vehicleCategoryId: cat.id,
            distanceKm: routeRes.route?.distanceKm || 4.2,
            durationMin: routeRes.route?.durationMin || 14,
            pickupLat: pickupCoords.lat,
            pickupLng: pickupCoords.lng,
            driverId: driverPreference === 'SPECIFIC' ? selectedFavoriteDriverId : undefined,
            numberOfStops: stops.length
          });
          if (quoteRes.quote) {
            newQuotes[cat.id] = quoteRes.quote;
          }
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

  // Handle autocomplete search
  const handleSearchLocations = async (text: string, field: 'PICKUP' | 'DESTINATION') => {
    setActiveSearchField(field);
    if (field === 'PICKUP') setPickupSearch(text);
    else setDestinationSearch(text);

    if (text.trim().length > 1) {
      setIsSearching(true);
      try {
        const res = await api.searchLocations(text);
        setSearchResults(res.locations || []);
      } catch {
        setSearchResults([]);
      }
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  };

  const handleSelectLocation = (loc: any) => {
    if (activeSearchField === 'PICKUP') {
      setPickupAddress(loc.name + (loc.address ? `, ${loc.address}` : ''));
      setPickupCoords({ lat: loc.lat, lng: loc.lng });
      setPickupSearch('');
      setIsEditingPickup(false);
    } else {
      setDestinationAddress(loc.name + (loc.address ? `, ${loc.address}` : ''));
      setDestCoords({ lat: loc.lat, lng: loc.lng });
      setDestinationSearch('');
    }
    setActiveSearchField(null);
    setIsSearching(false);
  };

  // Swap Pickup & Destination
  const handleSwapLocations = () => {
    const tempAddr = pickupAddress;
    const tempCoords = pickupCoords;
    setPickupAddress(destinationAddress);
    setPickupCoords(destCoords);
    setDestinationAddress(tempAddr);
    setDestCoords(tempCoords);
  };

  const handleVoiceBookingConfirm = async (parsed: any) => {
    if (parsed.entities?.destinationLocation) {
      setDestinationAddress(parsed.entities.destinationLocation.name);
      setDestCoords({
        lat: parsed.entities.destinationLocation.lat,
        lng: parsed.entities.destinationLocation.lng
      });
    }

    if (parsed.entities?.pickupLocation) {
      setPickupAddress(parsed.entities.pickupLocation.name);
      setPickupCoords({
        lat: parsed.entities.pickupLocation.lat,
        lng: parsed.entities.pickupLocation.lng
      });
    }

    if (parsed.entities?.vehicleCategoryId) {
      setSelectedCategory(parsed.entities.vehicleCategoryId);
    }

    if (parsed.entities?.paymentMethod) {
      setPaymentMethod(parsed.entities.paymentMethod);
    }

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

  // Map Click to Set Location
  const handleMapClick = async (lat: number, lng: number) => {
    try {
      const r = await api.reverseGeocode(lat, lng);
      const addr = r.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      // Set destination on map click by default, or pickup if editing pickup
      if (isEditingPickup) {
        setPickupCoords({ lat, lng });
        setPickupAddress(addr);
        setIsEditingPickup(false);
      } else {
        setDestCoords({ lat, lng });
        setDestinationAddress(addr);
      }
    } catch {
      if (isEditingPickup) {
        setPickupCoords({ lat, lng });
        setIsEditingPickup(false);
      } else {
        setDestCoords({ lat, lng });
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Interactive Booking Panel */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* Main Dual-Location Routing Card */}
          <div className="p-5 bg-slate-900 rounded-3xl shadow-xl border border-slate-800 space-y-4">
            
            {/* Header: User Welcome & Voice Button */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400">Book a Ride</p>
                <h2 className="text-xl font-extrabold text-white">
                  Where to, {currentUser.name.split(' ')[0]}? 👋
                </h2>
              </div>
              
              <button
                onClick={() => setShowVoiceModal(true)}
                className="flex items-center space-x-2 px-3.5 py-2 bg-gradient-to-tr from-brand-600 to-emerald-500 hover:from-brand-500 hover:to-emerald-400 text-white rounded-2xl text-xs font-bold shadow-md shadow-brand-500/20 transition-all hover:scale-105 active:scale-95"
              >
                <Mic className="w-4 h-4 animate-pulse" />
                <span>{t('voice_booking', language)}</span>
              </button>
            </div>

            {/* DUAL LOCATION INPUTS: PICKUP & DESTINATION */}
            <div className="relative p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
              
              {/* Connector Route Line Graphic */}
              <div className="absolute left-7 top-8 bottom-8 flex flex-col items-center justify-between pointer-events-none z-0">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20"></span>
                <span className="w-0.5 flex-1 bg-gradient-to-b from-emerald-500 via-brand-500 to-rose-500 my-1"></span>
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 ring-2 ring-rose-500/20"></span>
              </div>

              {/* 1. PICKUP LOCATION INPUT (Default: Current Location, Editable) */}
              <div className="relative pl-8 z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                    Pickup Location (Current GPS)
                  </span>
                  {!isEditingPickup && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingPickup(true);
                        setPickupSearch('');
                      }}
                      className="text-[11px] font-bold text-brand-400 hover:text-brand-300 underline"
                    >
                      Edit Pickup
                    </button>
                  )}
                </div>

                {isEditingPickup ? (
                  <div className="mt-1 flex items-center bg-slate-900 border border-brand-500 rounded-xl px-3 py-2 text-xs">
                    <MapPin className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      autoFocus
                      value={pickupSearch}
                      onChange={e => handleSearchLocations(e.target.value, 'PICKUP')}
                      placeholder="Type pickup address or landmark..."
                      className="w-full bg-transparent font-semibold text-white placeholder:text-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleDetectCurrentLocation}
                      title="Use Current GPS Location"
                      className="p-1 text-emerald-400 hover:bg-slate-800 rounded-lg shrink-0 ml-1"
                    >
                      <Crosshair className={`w-4 h-4 ${isLocatingGPS ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingPickup(false)}
                      className="p-1 text-slate-400 hover:text-white rounded-lg shrink-0 ml-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      setIsEditingPickup(true);
                      setPickupSearch('');
                    }}
                    className="mt-1 flex items-center justify-between bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl px-3 py-2.5 text-xs cursor-pointer transition-colors"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-bold text-white truncate">{pickupAddress}</span>
                    </div>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleDetectCurrentLocation();
                      }}
                      title="Refresh Current GPS"
                      className="flex items-center space-x-1 px-2 py-0.5 bg-emerald-950/60 border border-emerald-800 text-emerald-400 rounded-lg text-[10px] font-bold shrink-0 ml-2"
                    >
                      <Crosshair className={`w-3 h-3 ${isLocatingGPS ? 'animate-spin' : ''}`} />
                      <span>GPS</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Swap Button */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20">
                <button
                  type="button"
                  onClick={handleSwapLocations}
                  title="Swap Pickup and Destination"
                  className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-full border border-slate-700 shadow-md transition-transform active:scale-90"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 2. DESTINATION LOCATION INPUT */}
              <div className="relative pl-8 z-10">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-400">
                  Destination
                </span>
                <div className="mt-1 flex items-center bg-slate-900 border border-slate-800 focus-within:border-brand-500 rounded-xl px-3 py-2 text-xs">
                  <Search className="w-4 h-4 text-rose-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={destinationSearch}
                    onChange={e => handleSearchLocations(e.target.value, 'DESTINATION')}
                    placeholder={destinationAddress || t('search_destination', language)}
                    className="w-full bg-transparent font-semibold text-white placeholder:text-slate-500 focus:outline-none"
                  />
                  {destinationSearch && (
                    <button
                      type="button"
                      onClick={() => setDestinationSearch('')}
                      className="p-1 text-slate-400 hover:text-white shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Autocomplete Dropdown */}
              {isSearching && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 py-1.5 z-50 animate-in fade-in">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Matching Locations ({activeSearchField})
                  </div>
                  {searchResults.map(loc => (
                    <button
                      key={loc.id}
                      onClick={() => handleSelectLocation(loc)}
                      className="w-full text-left px-4 py-2.5 hover:bg-brand-950/40 flex items-start space-x-3 transition-colors border-b border-slate-800/50 last:border-0"
                    >
                      <MapPin className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-bold text-white truncate">{loc.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{loc.address}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

            </div>

            {/* Quick Popular Destination Chips */}
            <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pt-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                Popular:
              </span>
              {[
                { name: 'Lulu Mall', lat: 10.5360, lng: 76.2220 },
                { name: 'Cochin Airport (COK)', lat: 10.1518, lng: 76.3930 },
                { name: 'Railway Station', lat: 10.5186, lng: 76.2085 },
                { name: 'Infopark', lat: 10.0125, lng: 76.3620 }
              ].map((loc, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setDestinationAddress(loc.name);
                    setDestCoords({ lat: loc.lat, lng: loc.lng });
                    setDestinationSearch('');
                    setIsSearching(false);
                  }}
                  className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 font-semibold shrink-0 transition-colors text-[11px]"
                >
                  📍 {loc.name}
                </button>
              ))}
            </div>
          </div>

          {/* 1-Tap Quick Rebook Card (from Recent Trips) */}
          {recentTrips.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-brand-950/40 to-emerald-950/30 rounded-3xl border border-brand-800/40 flex items-center justify-between shadow-sm">
              <div className="flex items-center space-x-3 truncate mr-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-bold shadow-md shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div className="truncate">
                  <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">
                    Recent Route
                  </span>
                  <p className="text-xs font-extrabold text-white truncate">
                    {recentTrips[0].pickup_address.split(',')[0]} → {recentTrips[0].destination_address.split(',')[0]}
                  </p>
                  <p className="text-[11px] text-slate-400">₹{recentTrips[0].final_fare || recentTrips[0].fare_estimate} • {recentTrips[0].vehicle_category_display || 'Auto'}</p>
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
              <span className="text-xs font-bold text-brand-400">
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
                        ? 'bg-brand-950/50 border-brand-500 shadow-md ring-2 ring-brand-500/20'
                        : 'bg-slate-900 border-slate-800 hover:border-brand-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl shadow-inner shrink-0">
                        {cat.code === 'BIKE' ? '🏍️' : cat.code === 'AUTO' ? '🛺' : cat.code === 'MINI' ? '🚗' : cat.code === 'SEDAN' ? '🚘' : cat.code === 'SUV' ? '🚙' : '🚐'}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-extrabold text-sm text-white">
                            {cat.display_name}
                          </h4>
                          {cat.surge_enabled && quote && quote.surge_multiplier > 1.0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded-md">
                              {quote.surge_multiplier}x Surge
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {cat.passenger_capacity} seats • {cat.description}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-black text-white">
                        {quote ? `₹${quote.total_fare}` : '₹--'}
                      </div>
                      <p className="text-[10px] text-emerald-400 font-semibold">
                        {Math.floor(durationMin / 2) + 2} min away
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment & Driver Preferences */}
          <div className="p-5 bg-slate-900 rounded-3xl border border-slate-800 space-y-4 shadow-sm">
            
            {/* Driver Dispatch Preference */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Driver Dispatch Preference
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDriverPreference('ANY')}
                  className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center space-x-1.5 ${
                    driverPreference === 'ANY'
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Fastest Nearby</span>
                </button>

                <button
                  onClick={() => setDriverPreference('FAVORITES')}
                  className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center space-x-1.5 ${
                    driverPreference === 'FAVORITES'
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5" />
                  <span>Favorite Captains ({favoriteDrivers.length})</span>
                </button>
              </div>
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
                        ? 'bg-white text-slate-900 border-white shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {/* Confirm Booking Action Button */}
            <button
              onClick={handleCreateBooking}
              disabled={isSubmitting}
              className="w-full mt-2 py-4 bg-gradient-to-r from-brand-600 to-emerald-500 hover:from-brand-500 hover:to-emerald-400 disabled:opacity-50 text-white rounded-2xl font-extrabold text-base shadow-xl shadow-brand-500/25 transition-all flex items-center justify-center space-x-2 active:scale-98"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  <span>Matching Best Captain...</span>
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
          <div className="w-full h-[520px] lg:h-[760px] rounded-3xl overflow-hidden shadow-xl border border-slate-800 relative">
            <OpenStreetMap
              center={pickupCoords}
              pickup={{ lat: pickupCoords.lat, lng: pickupCoords.lng, address: pickupAddress }}
              destination={{ lat: destCoords.lat, lng: destCoords.lng, address: destinationAddress }}
              stops={stops}
              routePolyline={routePolyline}
              drivers={nearbyDrivers}
              onMapClick={handleMapClick}
              className="w-full h-full"
            />

            {/* Floating Location Overlay Badge */}
            <div className="absolute top-4 left-4 z-[400] bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-xl border border-slate-800 max-w-xs text-xs space-y-1">
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Pickup</p>
              </div>
              <p className="font-bold text-white truncate">{pickupAddress}</p>
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
