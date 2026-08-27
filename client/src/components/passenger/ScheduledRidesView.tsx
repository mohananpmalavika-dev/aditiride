import React, { useState, useEffect } from 'react';
import { User, LanguageCode, VehicleCategory, FareQuote } from '../../types/index.js';
import { api } from '../../services/api.js';
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Trash2,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Zap,
  Heart,
  Plane,
  Crosshair,
  Search,
  CheckCircle2,
  X,
  Repeat
} from 'lucide-react';

interface ScheduledRidesViewProps {
  currentUser: User;
  language: LanguageCode;
  onBookingDispatched?: (bookingId: string) => void;
}

export const ScheduledRidesView: React.FC<ScheduledRidesViewProps> = ({
  currentUser,
  language,
  onBookingDispatched
}) => {
  const [scheduledRides, setScheduledRides] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [favoriteDrivers, setFavoriteDrivers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [scheduleType, setScheduleType] = useState<'ONE_TIME' | 'RECURRING'>('ONE_TIME');
  const [pickupAddress, setPickupAddress] = useState('Swaraj Round, Thrissur');
  const [pickupCoords, setPickupCoords] = useState({ lat: 10.5276, lng: 76.2144 });
  const [destinationAddress, setDestinationAddress] = useState('Cochin International Airport (COK)');
  const [destCoords, setDestCoords] = useState({ lat: 10.1518, lng: 76.3930 });

  // Autocomplete Search
  const [activeSearchField, setActiveSearchField] = useState<'PICKUP' | 'DESTINATION' | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // One-time date/time
  const [scheduledDateTime, setScheduledDateTime] = useState('');

  // Recurring options
  const [recurringTime, setRecurringTime] = useState('08:30');
  const [recurringDays, setRecurringDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [recurrenceRule, setRecurrenceRule] = useState('WEEKDAYS');

  // Preferences & Estimates
  const [selectedCategory, setSelectedCategory] = useState('cat_sedan');
  const [driverPreference, setDriverPreference] = useState<'ANY' | 'FAVORITE'>('ANY');
  const [specificDriverId, setSpecificDriverId] = useState('');
  const [flightOrTrainNumber, setFlightOrTrainNumber] = useState('');
  const [estimatedFare, setEstimatedFare] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const DAYS_OF_WEEK = [
    { label: 'Mon', full: 'Monday' },
    { label: 'Tue', full: 'Tuesday' },
    { label: 'Wed', full: 'Wednesday' },
    { label: 'Thu', full: 'Thursday' },
    { label: 'Fri', full: 'Friday' },
    { label: 'Sat', full: 'Saturday' },
    { label: 'Sun', full: 'Sunday' }
  ];

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ridesRes, catRes, favRes] = await Promise.all([
        api.getScheduledRides(currentUser.id),
        api.getCategories(),
        api.getFavoriteDrivers(currentUser.id)
      ]);
      setScheduledRides(ridesRes.scheduled || []);
      setCategories(catRes.categories || []);
      setFavoriteDrivers(favRes.favorites || []);
      if (catRes.categories?.length > 0 && !selectedCategory) {
        setSelectedCategory(catRes.categories[0].id);
      }
    } catch (err) {
      console.error('Failed to load scheduled rides data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Default tomorrow at 9:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const localIso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setScheduledDateTime(localIso);
  }, [currentUser.id]);

  // Recalculate Fare Estimate
  useEffect(() => {
    if (!pickupCoords || !destCoords || !selectedCategory) return;
    api.estimateFare({
      vehicleCategoryId: selectedCategory,
      distanceKm: 28.5,
      durationMin: 45,
      pickupLat: pickupCoords.lat,
      pickupLng: pickupCoords.lng,
      driverId: driverPreference === 'FAVORITE' ? specificDriverId : undefined
    }).then(res => {
      if (res.quote) setEstimatedFare(res.quote.total_fare);
    }).catch(() => {});
  }, [pickupCoords, destCoords, selectedCategory, driverPreference, specificDriverId]);

  const handleSearchLocations = async (text: string, field: 'PICKUP' | 'DESTINATION') => {
    setActiveSearchField(field);
    if (field === 'PICKUP') setPickupAddress(text);
    else setDestinationAddress(text);

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
    const full = loc.name + (loc.address ? `, ${loc.address}` : '');
    if (activeSearchField === 'PICKUP') {
      setPickupAddress(full);
      setPickupCoords({ lat: loc.lat, lng: loc.lng });
    } else {
      setDestinationAddress(full);
      setDestCoords({ lat: loc.lat, lng: loc.lng });
    }
    setActiveSearchField(null);
    setIsSearching(false);
  };

  const toggleRecurringDay = (day: string) => {
    setRecurringDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleCreateSchedule = async () => {
    if (scheduleType === 'ONE_TIME' && !scheduledDateTime) {
      alert('Please select a valid scheduled date & time');
      return;
    }

    if (scheduleType === 'RECURRING' && recurringDays.length === 0) {
      alert('Please select at least one day for your recurring ride');
      return;
    }

    setIsSubmitting(true);
    try {
      const scheduledTimeStr =
        scheduleType === 'ONE_TIME'
          ? scheduledDateTime
          : `${new Date().toISOString().split('T')[0]}T${recurringTime}:00`;

      const ruleStr =
        scheduleType === 'RECURRING'
          ? `RECURRING_${recurringDays.join(',')}_${recurringTime}`
          : 'NONE';

      await api.createScheduledRide({
        passengerId: currentUser.id,
        pickupLat: pickupCoords.lat,
        pickupLng: pickupCoords.lng,
        pickupAddress,
        destinationLat: destCoords.lat,
        destinationLng: destCoords.lng,
        destinationAddress,
        scheduledTime: scheduledTimeStr,
        recurrenceRule: ruleStr,
        vehicleCategoryId: selectedCategory,
        driverPreference,
        specificDriverId: driverPreference === 'FAVORITE' ? specificDriverId : undefined,
        flightOrTrainNumber: flightOrTrainNumber.trim() || undefined
      });

      setShowCreateModal(false);
      loadData();
      alert('✅ Ride scheduled successfully! You will receive live reminder updates before pickup.');
    } catch (err: any) {
      alert(err.message || 'Failed to create schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSchedule = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled ride?')) return;
    try {
      await api.cancelScheduledRide(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel');
    }
  };

  const handleDispatchNow = async (id: string) => {
    if (!confirm('Do you want to dispatch and start this booking right now?')) return;
    try {
      const res = await api.dispatchScheduledRideNow(id);
      alert('🚀 Ride dispatched live! Redirecting to live tracking...');
      if (res.booking?.id && onBookingDispatched) {
        onBookingDispatched(res.booking.id);
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch');
    }
  };

  const formatHumanTime = (isoString: string, recurrence?: string) => {
    if (recurrence && recurrence.startsWith('RECURRING')) {
      const parts = recurrence.split('_');
      const days = parts[1] || 'Mon-Fri';
      const time = parts[2] || '08:30';
      return `🔄 Every ${days} at ${time}`;
    }
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-5 text-slate-100">
      
      {/* Top Banner Card */}
      <div className="p-6 bg-slate-900 rounded-3xl shadow-sm border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center font-bold">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Scheduled & Recurring Rides</h2>
            <p className="text-xs text-slate-400">
              Book future one-time rides or automate daily office commutes with priority captain matching.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-brand-500/25 transition-transform active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule New Ride</span>
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Active Schedules</p>
          <p className="text-2xl font-black text-white mt-1">{scheduledRides.length}</p>
        </div>

        <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Recurring Commutes</p>
          <p className="text-2xl font-black text-brand-400 mt-1">
            {scheduledRides.filter(r => r.recurrence_rule && r.recurrence_rule !== 'NONE').length}
          </p>
        </div>

        <div className="p-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Favorite Match Guarantee</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">100%</p>
        </div>
      </div>

      {/* List of Scheduled Bookings */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center bg-slate-900 rounded-3xl border border-slate-800 space-y-2">
            <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-xs text-slate-400">Loading scheduled bookings...</p>
          </div>
        ) : scheduledRides.length === 0 ? (
          <div className="p-12 text-center bg-slate-900 rounded-3xl border border-slate-800 space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
              <Calendar className="w-7 h-7" />
            </div>
            <h3 className="font-extrabold text-base text-white">No Scheduled Rides Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Planning an early morning flight, hospital visit, or daily office commute? Schedule ahead to guarantee your ride.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md inline-flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Schedule</span>
            </button>
          </div>
        ) : (
          scheduledRides.map(ride => {
            const isRecurring = ride.recurrence_rule && ride.recurrence_rule !== 'NONE';
            return (
              <div
                key={ride.id}
                className="p-5 bg-slate-900 rounded-3xl shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                        ride.status === 'PENDING'
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : ride.status === 'DISPATCHED'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {ride.status}
                    </span>

                    {isRecurring && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800 flex items-center space-x-1">
                        <Repeat className="w-3 h-3" />
                        <span>Recurring Commute</span>
                      </span>
                    )}

                    <span className="text-xs font-bold text-slate-400">
                      {ride.vehicle_category_display || ride.vehicle_category_name || 'Sedan'}
                    </span>
                  </div>

                  {/* Route */}
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-base text-white">
                      {ride.pickup_address.split(',')[0]} → {ride.destination_address.split(',')[0]}
                    </h4>
                    <p className="text-xs text-slate-400 truncate">
                      {ride.pickup_address} → {ride.destination_address}
                    </p>
                  </div>

                  {/* Details Badge Bar */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 pt-1">
                    <span className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 font-bold">
                      <Clock className="w-3.5 h-3.5 text-brand-400" />
                      <span>{formatHumanTime(ride.scheduled_time, ride.recurrence_rule)}</span>
                    </span>

                    {ride.driver_name && (
                      <span className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 font-bold text-amber-300">
                        <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                        <span>{ride.driver_name} (⭐ {ride.driver_rating || '4.9'})</span>
                      </span>
                    )}

                    {ride.flight_or_train_number && (
                      <span className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 font-bold text-blue-400">
                        <Plane className="w-3.5 h-3.5" />
                        <span>Track #{ride.flight_or_train_number}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 md:self-center shrink-0">
                  {ride.status === 'PENDING' && (
                    <button
                      onClick={() => handleDispatchNow(ride.id)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-transform active:scale-95 flex items-center space-x-1"
                      title="Dispatch as live booking right now"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Dispatch Now</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleCancelSchedule(ride.id)}
                    className="px-3 py-2 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 rounded-xl text-xs font-bold border border-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Comprehensive Scheduling Studio Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-800 space-y-5 text-slate-100 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-brand-400" />
                <h3 className="font-extrabold text-lg text-white">Schedule Future / Recurring Ride</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Type Switcher: One-Time vs Recurring */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setScheduleType('ONE_TIME')}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                  scheduleType === 'ONE_TIME'
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>One-Time Ride</span>
              </button>

              <button
                type="button"
                onClick={() => setScheduleType('RECURRING')}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                  scheduleType === 'RECURRING'
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Repeat className="w-4 h-4" />
                <span>Recurring Commute</span>
              </button>
            </div>

            {/* Locations */}
            <div className="space-y-3 relative">
              {/* Pickup */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Pickup Location</label>
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs">
                  <MapPin className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={pickupAddress}
                    onChange={e => handleSearchLocations(e.target.value, 'PICKUP')}
                    onFocus={() => setActiveSearchField('PICKUP')}
                    placeholder="Enter pickup address..."
                    className="w-full bg-transparent font-semibold text-white placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Destination */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Destination Location</label>
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs">
                  <MapPin className="w-4 h-4 text-rose-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={destinationAddress}
                    onChange={e => handleSearchLocations(e.target.value, 'DESTINATION')}
                    onFocus={() => setActiveSearchField('DESTINATION')}
                    placeholder="Enter destination address..."
                    className="w-full bg-transparent font-semibold text-white placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Search Dropdown */}
              {isSearching && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-950 rounded-2xl shadow-2xl border border-slate-800 py-1.5 z-50 animate-in fade-in max-h-48 overflow-y-auto">
                  {searchResults.map(loc => (
                    <button
                      key={loc.id}
                      onClick={() => handleSelectLocation(loc)}
                      className="w-full text-left px-4 py-2 hover:bg-slate-800 flex items-start space-x-3 border-b border-slate-800/50 last:border-0"
                    >
                      <MapPin className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-bold text-white truncate">{loc.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{loc.address}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Time / Date Inputs */}
            {scheduleType === 'ONE_TIME' ? (
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Pickup Date & Time</label>
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={e => setScheduledDateTime(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl font-bold text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            ) : (
              <div className="space-y-3 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Daily Pickup Time</label>
                  <input
                    type="time"
                    value={recurringTime}
                    onChange={e => setRecurringTime(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl font-bold text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Repeating Days</label>
                  <div className="flex items-center justify-between gap-1">
                    {DAYS_OF_WEEK.map(d => {
                      const isSelected = recurringDays.includes(d.label);
                      return (
                        <button
                          key={d.label}
                          type="button"
                          onClick={() => toggleRecurringDay(d.label)}
                          className={`w-10 h-10 rounded-xl text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-brand-600 text-white shadow-md ring-2 ring-brand-500/30'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Vehicle Category Selector */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Vehicle Category</label>
              <div className="grid grid-cols-3 gap-2">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-brand-950/60 border-brand-500 text-white ring-2 ring-brand-500/20'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <p className="text-lg">
                      {cat.code === 'BIKE' ? '🏍️' : cat.code === 'AUTO' ? '🛺' : cat.code === 'MINI' ? '🚗' : cat.code === 'SEDAN' ? '🚘' : '🚙'}
                    </p>
                    <p className="text-xs font-bold mt-1 truncate">{cat.display_name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Driver Preference */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">Driver Assignment</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDriverPreference('ANY')}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    driverPreference === 'ANY'
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  ⚡ Fastest Verified Captain
                </button>

                <button
                  type="button"
                  onClick={() => setDriverPreference('FAVORITE')}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    driverPreference === 'FAVORITE'
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  ⭐ Favorite Drivers ({favoriteDrivers.length})
                </button>
              </div>

              {driverPreference === 'FAVORITE' && favoriteDrivers.length > 0 && (
                <div className="mt-2">
                  <select
                    value={specificDriverId}
                    onChange={e => setSpecificDriverId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    <option value="">Any Favorite Driver</option>
                    {favoriteDrivers.map(f => (
                      <option key={f.driver_id} value={f.driver_id}>
                        {f.driver_name} (⭐ {f.rating_avg}) - {f.vehicle_brand} {f.vehicle_model}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Flight / Train Number */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                Flight / Train Number (Optional Delay Tracking)
              </label>
              <input
                type="text"
                value={flightOrTrainNumber}
                onChange={e => setFlightOrTrainNumber(e.target.value)}
                placeholder="e.g. AI-512 or 12625 Kerala Express"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500"
              />
            </div>

            {/* Estimated Fare Preview */}
            {estimatedFare && (
              <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/80 rounded-2xl flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-400">Authoritative Estimated Fare</span>
                <span className="text-base font-black text-emerald-300">₹{estimatedFare}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCreateSchedule}
                disabled={isSubmitting}
                className="py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-extrabold shadow-lg shadow-brand-500/25 transition-transform active:scale-95"
              >
                {isSubmitting ? 'Scheduling...' : 'Confirm Schedule'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
