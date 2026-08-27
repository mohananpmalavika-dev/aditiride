import React, { useState, useEffect } from 'react';
import { User, LanguageCode, VehicleCategory } from '../../types/index.js';
import { api } from '../../services/api.js';
import {
  Truck,
  Bus,
  Package,
  Compass,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Star,
  Users,
  ChevronRight,
  Phone,
  Sparkles,
  Zap,
  Info,
  Navigation
} from 'lucide-react';

interface LogisticsAndToursViewProps {
  currentUser: User;
  language: LanguageCode;
  onBookingCreated: (bookingId: string) => void;
}

export const LogisticsAndToursView: React.FC<LogisticsAndToursViewProps> = ({
  currentUser,
  language,
  onBookingCreated
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'TRUCKS' | 'BUSES' | 'TOURS' | 'PARCELS'>('TRUCKS');
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [tourPackages, setTourPackages] = useState<any[]>([]);
  const [selectedTour, setSelectedTour] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Common Location State
  const [pickupAddress, setPickupAddress] = useState('Swaraj Round, Thrissur');
  const [pickupCoords, setPickupCoords] = useState({ lat: 10.5276, lng: 76.2144 });
  const [destinationAddress, setDestinationAddress] = useState('Kochi Port / Ernakulam');
  const [destCoords, setDestCoords] = useState({ lat: 9.9674, lng: 76.2429 });

  // Autocomplete Search
  const [activeSearchField, setActiveSearchField] = useState<'PICKUP' | 'DESTINATION' | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Truck / Lorry State
  const [selectedTruckCat, setSelectedTruckCat] = useState('cat_pickup');
  const [goodsType, setGoodsType] = useState('HOUSE_SHIFTING');
  const [needHelpers, setNeedHelpers] = useState(true);
  const [truckFare, setTruckFare] = useState<number>(1850);

  // Tourist Bus State
  const [selectedBusCat, setSelectedBusCat] = useState('cat_tempo_traveller');
  const [tourStartDate, setTourStartDate] = useState('');
  const [tourDays, setTourDays] = useState(2);
  const [passengerCount, setPassengerCount] = useState(18);
  const [tripPurpose, setTripPurpose] = useState('FAMILY_FUNCTION');
  const [busFare, setBusFare] = useState<number>(7500);

  // Parcel & Shop Delivery State
  const [receiverName, setReceiverName] = useState('Rahul Nair');
  const [receiverPhone, setReceiverPhone] = useState('+91 9846111222');
  const [parcelType, setParcelType] = useState('SHOP_PARCEL');
  const [weightCategory, setWeightCategory] = useState('UP_TO_5KG');
  const [isFragile, setIsFragile] = useState(false);
  const [parcelNotes, setParcelNotes] = useState('Handle with care • Store purchase delivery');
  const [parcelFare, setParcelFare] = useState<number>(120);

  const loadData = async () => {
    try {
      const [catRes, toursRes] = await Promise.all([
        api.getCategories(),
        api.getTourPackages()
      ]);
      setCategories(catRes.categories || []);
      setTourPackages(toursRes.packages || []);
    } catch (err) {
      console.error('Failed to load logistics & tours data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setTourStartDate(tomorrow.toISOString().split('T')[0]);
  }, []);

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

  // 1. Handle Truck / Lorry Booking
  const handleBookTruck = async () => {
    setIsLoading(true);
    try {
      const res = await api.createBooking({
        passengerId: currentUser.id,
        pickupLat: pickupCoords.lat,
        pickupLng: pickupCoords.lng,
        pickupAddress,
        destinationLat: destCoords.lat,
        destinationLng: destCoords.lng,
        destinationAddress,
        vehicleCategoryId: selectedTruckCat,
        bookingType: 'INSTANT',
        paymentMethod: 'UPI'
      });
      alert('🚚 Commercial Truck booked successfully! Driver is being assigned.');
      if (res.booking?.id) {
        onBookingCreated(res.booking.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to book truck');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Handle Tourist Bus Booking
  const handleBookBus = async () => {
    setIsLoading(true);
    try {
      const res = await api.createBooking({
        passengerId: currentUser.id,
        pickupLat: pickupCoords.lat,
        pickupLng: pickupCoords.lng,
        pickupAddress,
        destinationLat: destCoords.lat,
        destinationLng: destCoords.lng,
        destinationAddress,
        vehicleCategoryId: selectedBusCat,
        bookingType: 'OUTSTATION',
        scheduledAt: tourStartDate,
        paymentMethod: 'UPI'
      });
      alert('🚌 Tourist Bus charter booked successfully! Driver itinerary coordinated.');
      if (res.booking?.id) {
        onBookingCreated(res.booking.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to book bus');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Handle Curated Tour Package Booking
  const handleBookTourPackage = async (pkg: any) => {
    setIsLoading(true);
    try {
      const res = await api.bookTourPackage({
        packageId: pkg.id,
        passengerId: currentUser.id,
        startDate: tourStartDate,
        pickupAddress,
        pickupLat: pickupCoords.lat,
        pickupLng: pickupCoords.lng,
        selectedVehicleCategory: 'cat_tempo_traveller',
        numberOfTravellers: 6
      });
      alert(`🎉 Tour package for "${pkg.title}" booked successfully!`);
      if (res.booking?.id) {
        onBookingCreated(res.booking.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to book tour package');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Handle Express Parcel Delivery
  const handleBookParcel = async () => {
    setIsLoading(true);
    try {
      const res = await api.bookParcelDelivery({
        senderId: currentUser.id,
        pickupAddress,
        pickupLat: pickupCoords.lat,
        pickupLng: pickupCoords.lng,
        destinationAddress,
        destinationLat: destCoords.lat,
        destinationLng: destCoords.lng,
        receiverName,
        receiverPhone,
        packageType: parcelType,
        weightCategory,
        isFragile,
        notes: parcelNotes,
        vehicleCategoryId: 'cat_parcel_express'
      });
      alert(`📦 Parcel Pickup Scheduled! Receiver PIN: ${res.deliveryPin}. Live tracking is active.`);
      if (res.booking?.id) {
        onBookingCreated(res.booking.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to place parcel delivery order');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 space-y-6 text-slate-100">
      
      {/* Top Banner */}
      <div className="p-6 bg-slate-900 rounded-3xl shadow-sm border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center font-bold">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Logistics, Tourist Buses & Tour Packages</h2>
            <p className="text-xs text-slate-400">
              Commercial Lorries, Pickup Trucks, 26–49 Seater Luxury Tourist Buses, Kerala Tour Packages & Express Parcels.
            </p>
          </div>
        </div>

        {/* 4-Way Mode Selector */}
        <div className="flex items-center space-x-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800 overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab('TRUCKS')}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeSubTab === 'TRUCKS' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Lorries & Pickups</span>
          </button>

          <button
            onClick={() => setActiveSubTab('BUSES')}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeSubTab === 'BUSES' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bus className="w-4 h-4" />
            <span>Tourist Buses</span>
          </button>

          <button
            onClick={() => setActiveSubTab('TOURS')}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeSubTab === 'TOURS' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Tour Packages</span>
          </button>

          <button
            onClick={() => setActiveSubTab('PARCELS')}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              activeSubTab === 'PARCELS' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Parcel & Shop</span>
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* 1. LORRIES & PICKUP TRUCKS                           */}
      {/* ==================================================== */}
      {activeSubTab === 'TRUCKS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <div className="lg:col-span-7 space-y-4">
            <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 space-y-5">
              <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
                <Truck className="w-5 h-5 text-brand-400" />
                <span>Heavy Commercial & Goods Transport</span>
              </h3>

              {/* Truck Vehicle Selectors */}
              <div className="grid grid-cols-3 gap-3">
                <div
                  onClick={() => { setSelectedTruckCat('cat_pickup'); setTruckFare(1450); }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all text-center ${
                    selectedTruckCat === 'cat_pickup'
                      ? 'bg-brand-950/60 border-brand-500 ring-2 ring-brand-500/20'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <p className="text-2xl">🛻</p>
                  <h4 className="font-extrabold text-xs text-white mt-1">Pickup / Tata Ace</h4>
                  <p className="text-[10px] text-slate-400">Up to 1.5 Ton</p>
                  <p className="text-xs font-black text-brand-400 mt-2">₹32/km</p>
                </div>

                <div
                  onClick={() => { setSelectedTruckCat('cat_lorry_14ft'); setTruckFare(2850); }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all text-center ${
                    selectedTruckCat === 'cat_lorry_14ft'
                      ? 'bg-brand-950/60 border-brand-500 ring-2 ring-brand-500/20'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <p className="text-2xl">🚚</p>
                  <h4 className="font-extrabold text-xs text-white mt-1">14ft Goods Lorry</h4>
                  <p className="text-[10px] text-slate-400">Up to 4.0 Ton</p>
                  <p className="text-xs font-black text-brand-400 mt-2">₹48/km</p>
                </div>

                <div
                  onClick={() => { setSelectedTruckCat('cat_truck_20ft'); setTruckFare(5200); }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all text-center ${
                    selectedTruckCat === 'cat_truck_20ft'
                      ? 'bg-brand-950/60 border-brand-500 ring-2 ring-brand-500/20'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <p className="text-2xl">🚛</p>
                  <h4 className="font-extrabold text-xs text-white mt-1">20ft Heavy Truck</h4>
                  <p className="text-[10px] text-slate-400">Up to 10.0 Ton</p>
                  <p className="text-xs font-black text-brand-400 mt-2">₹75/km</p>
                </div>
              </div>

              {/* Locations Input */}
              <div className="space-y-3 relative">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Loading / Pickup Address</label>
                  <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs">
                    <MapPin className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      value={pickupAddress}
                      onChange={e => handleSearchLocations(e.target.value, 'PICKUP')}
                      onFocus={() => setActiveSearchField('PICKUP')}
                      className="w-full bg-transparent font-semibold text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Unloading / Destination Address</label>
                  <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs">
                    <MapPin className="w-4 h-4 text-rose-400 mr-2 shrink-0" />
                    <input
                      type="text"
                      value={destinationAddress}
                      onChange={e => handleSearchLocations(e.target.value, 'DESTINATION')}
                      onFocus={() => setActiveSearchField('DESTINATION')}
                      className="w-full bg-transparent font-semibold text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Autocomplete Dropdown */}
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

              {/* Goods Type & Helpers */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Type of Goods</label>
                  <select
                    value={goodsType}
                    onChange={e => setGoodsType(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl font-bold text-white"
                  >
                    <option value="HOUSE_SHIFTING">House Shifting / Furniture</option>
                    <option value="COMMERCIAL_CARGO">Commercial & Wholesale Goods</option>
                    <option value="CONSTRUCTION_MATERIALS">Construction / Hardware</option>
                    <option value="AGRICULTURAL">Agricultural & Farm Produce</option>
                    <option value="MACHINERY">Machinery & Industrial Parts</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-400 block mb-1">Loading Helpers</label>
                  <button
                    type="button"
                    onClick={() => setNeedHelpers(!needHelpers)}
                    className={`w-full p-2.5 rounded-xl border font-bold text-center transition-all ${
                      needHelpers
                        ? 'bg-emerald-950/60 border-emerald-700 text-emerald-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {needHelpers ? '✓ Need 2 Helpers (+₹400)' : 'No Helpers Required'}
                  </button>
                </div>
              </div>

              {/* Estimated Total & Booking Button */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Guaranteed Commercial Fare</p>
                  <p className="text-2xl font-black text-emerald-400">₹{truckFare + (needHelpers ? 400 : 0)}</p>
                </div>

                <button
                  onClick={handleBookTruck}
                  disabled={isLoading}
                  className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-extrabold text-xs shadow-lg shadow-brand-500/25 transition-transform active:scale-95 flex items-center space-x-1.5"
                >
                  <Zap className="w-4 h-4" />
                  <span>{isLoading ? 'Booking...' : 'Book Lorry / Truck'}</span>
                </button>
              </div>

            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 space-y-3">
              <h4 className="font-extrabold text-sm text-white">Why Book Commercial Logistics with AditiRide?</h4>
              <ul className="text-xs space-y-2.5 text-slate-300">
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span><strong>Verified Commercial Drivers</strong> with valid National & State goods transport permits.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span><strong>Live GPS Consignment Tracking</strong> for senders, receivers, and warehouse managers.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span><strong>Secure Digital Proof-of-Delivery</strong> with OTP & recipient e-signature.</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <span><strong>Goods Transit Insurance Coverage</strong> available on high-value cargo.</span>
                </li>
              </ul>
            </div>
          </div>

        </div>
      )}

      {/* ==================================================== */}
      {/* 2. TOURIST BUSES & GROUP CHARTERS                    */}
      {/* ==================================================== */}
      {activeSubTab === 'BUSES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <div className="lg:col-span-7 space-y-4">
            <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 space-y-5">
              <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
                <Bus className="w-5 h-5 text-brand-400" />
                <span>Tourist Buses & Group Charters</span>
              </h3>

              {/* Bus Categories */}
              <div className="grid grid-cols-3 gap-3">
                <div
                  onClick={() => { setSelectedBusCat('cat_tempo_traveller'); setBusFare(4500); }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all text-center ${
                    selectedBusCat === 'cat_tempo_traveller'
                      ? 'bg-brand-950/60 border-brand-500 ring-2 ring-brand-500/20'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <p className="text-2xl">🚐</p>
                  <h4 className="font-extrabold text-xs text-white mt-1">Tempo Traveller</h4>
                  <p className="text-[10px] text-slate-400">17–26 Seater AC</p>
                  <p className="text-xs font-black text-brand-400 mt-2">₹34/km</p>
                </div>

                <div
                  onClick={() => { setSelectedBusCat('cat_bus_35'); setBusFare(8500); }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all text-center ${
                    selectedBusCat === 'cat_bus_35'
                      ? 'bg-brand-950/60 border-brand-500 ring-2 ring-brand-500/20'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <p className="text-2xl">🚌</p>
                  <h4 className="font-extrabold text-xs text-white mt-1">35-Seater Coach</h4>
                  <p className="text-[10px] text-slate-400">Deluxe Tourist Bus</p>
                  <p className="text-xs font-black text-brand-400 mt-2">₹62/km</p>
                </div>

                <div
                  onClick={() => { setSelectedBusCat('cat_bus_49'); setBusFare(14500); }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all text-center ${
                    selectedBusCat === 'cat_bus_49'
                      ? 'bg-brand-950/60 border-brand-500 ring-2 ring-brand-500/20'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <p className="text-2xl">🚍</p>
                  <h4 className="font-extrabold text-xs text-white mt-1">49-Seater Volvo</h4>
                  <p className="text-[10px] text-slate-400">Multi-Axle Luxury Bus</p>
                  <p className="text-xs font-black text-brand-400 mt-2">₹92/km</p>
                </div>
              </div>

              {/* Tour Inputs */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Departure Date</label>
                  <input
                    type="date"
                    value={tourStartDate}
                    onChange={e => setTourStartDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl font-bold text-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-400 block mb-1">Duration (Days)</label>
                  <select
                    value={tourDays}
                    onChange={e => setTourDays(parseInt(e.target.value))}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl font-bold text-white"
                  >
                    <option value={1}>1 Day (Local Sightseeing / Event)</option>
                    <option value={2}>2 Days / 1 Night (Weekend Tour)</option>
                    <option value={3}>3 Days / 2 Nights (Outstation / Sabarimala)</option>
                    <option value={5}>5 Days (Complete South India Tour)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Charter Purpose</label>
                <select
                  value={tripPurpose}
                  onChange={e => setTripPurpose(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl font-bold text-xs text-white"
                >
                  <option value="FAMILY_FUNCTION">Family Wedding / Reception Function</option>
                  <option value="PILGRIMAGE">Sabarimala / Guruvayur / Velankanni Pilgrimage</option>
                  <option value="COLLEGE_TOUR">College / School Educational Tour</option>
                  <option value="CORPORATE">Corporate Team Outing & Conference</option>
                </select>
              </div>

              {/* Total & Book */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">All-Inclusive Charter Estimate</p>
                  <p className="text-2xl font-black text-emerald-400">₹{busFare * tourDays}</p>
                  <p className="text-[10px] text-slate-400">Includes Driver Batta, Toll & Interstate Permit</p>
                </div>

                <button
                  onClick={handleBookBus}
                  disabled={isLoading}
                  className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-extrabold text-xs shadow-lg shadow-brand-500/25 transition-transform active:scale-95 flex items-center space-x-1.5"
                >
                  <Bus className="w-4 h-4" />
                  <span>{isLoading ? 'Booking...' : 'Book Bus Charter'}</span>
                </button>
              </div>

            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 space-y-3">
              <h4 className="font-extrabold text-sm text-white">Included Luxury Bus Amenities</h4>
              <ul className="text-xs space-y-2 text-slate-300">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Pushback Reclining Seats with Leg Rests</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Surround Sound Audio System & Dual LED TVs</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Individual USB Mobile Charging Ports</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Air Suspension for Smooth Ghat Road Travel</span>
                </li>
              </ul>
            </div>
          </div>

        </div>
      )}

      {/* ==================================================== */}
      {/* 3. CURATED TOUR PACKAGES                             */}
      {/* ==================================================== */}
      {activeSubTab === 'TOURS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tourPackages.map(tour => (
              <div
                key={tour.id}
                className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-sm flex flex-col justify-between hover:border-brand-500 transition-all group"
              >
                <div>
                  <div className="h-44 overflow-hidden relative">
                    <img
                      src={tour.image_url}
                      alt={tour.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-black text-brand-400 border border-slate-700">
                      {tour.badge || 'Popular'}
                    </div>
                    <div className="absolute bottom-3 right-3 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-lg text-xs font-bold text-amber-400 flex items-center space-x-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{tour.rating}</span>
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <h4 className="font-black text-sm text-white">{tour.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2">{tour.subtitle}</p>
                    
                    <div className="flex items-center space-x-2 text-[11px] text-slate-300 pt-1">
                      <Clock className="w-3.5 h-3.5 text-brand-400" />
                      <span>{tour.duration_days} Days / {tour.duration_nights} Night</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0 border-t border-slate-800 mt-2 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400">Starting from</p>
                    <p className="text-base font-black text-emerald-400">₹{tour.base_price}</p>
                  </div>

                  <button
                    onClick={() => handleBookTourPackage(tour)}
                    className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md transition-transform active:scale-95"
                  >
                    Book Tour
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. EXPRESS PARCEL & LOCAL SHOP DELIVERIES            */}
      {/* ==================================================== */}
      {activeSubTab === 'PARCELS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <div className="lg:col-span-7 space-y-4">
            <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 space-y-5">
              <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
                <Package className="w-5 h-5 text-brand-400" />
                <span>Aditi Express Parcel & Local Shop Delivery</span>
              </h3>

              {/* Package Type Grid */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'DOCS', icon: '📄', label: 'Documents' },
                  { id: 'SHOP_PARCEL', icon: '🛍️', label: 'Shop / Retail' },
                  { id: 'FOOD_MEDS', icon: '💊', label: 'Medicine/Food' },
                  { id: 'ELECTRONICS', icon: '📦', label: 'Box Package' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setParcelType(p.id)}
                    className={`p-3 rounded-2xl border text-center transition-all ${
                      parcelType === p.id
                        ? 'bg-brand-950/60 border-brand-500 text-white ring-2 ring-brand-500/20'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <p className="text-xl">{p.icon}</p>
                    <p className="text-[10px] font-bold mt-1 truncate">{p.label}</p>
                  </button>
                ))}
              </div>

              {/* Addresses */}
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Pickup Store / House Address</label>
                  <input
                    type="text"
                    value={pickupAddress}
                    onChange={e => setPickupAddress(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl font-bold text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Delivery Destination Address</label>
                  <input
                    type="text"
                    value={destinationAddress}
                    onChange={e => setDestinationAddress(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl font-bold text-xs text-white"
                  />
                </div>
              </div>

              {/* Receiver Info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={receiverName}
                    onChange={e => setReceiverName(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl font-bold text-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-400 block mb-1">Recipient Phone</label>
                  <input
                    type="text"
                    value={receiverPhone}
                    onChange={e => setReceiverPhone(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl font-bold text-white"
                  />
                </div>
              </div>

              {/* Options */}
              <div className="flex items-center space-x-4 text-xs">
                <label
                  onClick={() => setIsFragile(!isFragile)}
                  className="flex items-center space-x-2 cursor-pointer font-bold text-slate-300"
                >
                  <input type="checkbox" checked={isFragile} readOnly className="rounded text-brand-600" />
                  <span>Fragile / Glass Items</span>
                </label>
              </div>

              {/* Submit Parcel Button */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Express Delivery Fee</p>
                  <p className="text-2xl font-black text-emerald-400">₹{parcelFare}</p>
                  <p className="text-[10px] text-slate-400">Delivery in under 45 minutes</p>
                </div>

                <button
                  onClick={handleBookParcel}
                  disabled={isLoading}
                  className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-extrabold text-xs shadow-lg shadow-brand-500/25 transition-transform active:scale-95 flex items-center space-x-1.5"
                >
                  <Package className="w-4 h-4" />
                  <span>{isLoading ? 'Booking...' : 'Dispatch Parcel Now'}</span>
                </button>
              </div>

            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 space-y-3">
              <h4 className="font-extrabold text-sm text-white">Secure Delivery Verification PIN</h4>
              <p className="text-xs text-slate-300">
                Every parcel dispatch generates a 4-digit security verification PIN. The delivery rider can only complete the drop-off after the recipient shares their secret PIN.
              </p>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono font-bold text-brand-400">
                🔒 Anti-Theft & Sealed Drop-off Guarantee
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
