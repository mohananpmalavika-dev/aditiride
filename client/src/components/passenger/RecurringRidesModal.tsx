import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { User, RecurringRideSeries, VehicleCategory } from '../../types/index.js';
import {
  Repeat,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  AlertCircle,
  X,
  Plus,
  Play,
  Pause,
  Trash2,
  CalendarX,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface RecurringRidesModalProps {
  currentUser: User;
  onClose: () => void;
  categories: VehicleCategory[];
}

export const RecurringRidesModal: React.FC<RecurringRidesModalProps> = ({
  currentUser,
  onClose,
  categories
}) => {
  const [activeTab, setActiveTab] = useState<'MY_SERIES' | 'CREATE_SERIES'>('MY_SERIES');
  const [seriesList, setSeriesList] = useState<RecurringRideSeries[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [pickupAddress, setPickupAddress] = useState('Swaraj Round, Thrissur');
  const [pickupLat, setPickupLat] = useState(10.5276);
  const [pickupLng, setPickupLng] = useState(76.2144);
  const [destinationAddress, setDestinationAddress] = useState('Infopark Phase 1, Kakkanad, Kochi');
  const [destinationLat, setDestinationLat] = useState(10.0104);
  const [destinationLng, setDestinationLng] = useState(76.3639);
  const [vehicleCategoryId, setVehicleCategoryId] = useState('cat_auto');
  const [pickupTime, setPickupTime] = useState('08:30');
  const [selectedDays, setSelectedDays] = useState<string[]>(['MON', 'TUE', 'WED', 'THU', 'FRI']);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const weekDays = [
    { id: 'MON', label: 'Mon' },
    { id: 'TUE', label: 'Tue' },
    { id: 'WED', label: 'Wed' },
    { id: 'THU', label: 'Thu' },
    { id: 'FRI', label: 'Fri' },
    { id: 'SAT', label: 'Sat' },
    { id: 'SUN', label: 'Sun' }
  ];

  useEffect(() => {
    loadSeries();
  }, []);

  const loadSeries = async () => {
    setLoading(true);
    try {
      const res = await api.getRecurringSeries();
      if (res.series) setSeriesList(res.series);
    } catch (e) {
      console.warn('Failed to load recurring series:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (dayId: string) => {
    if (selectedDays.includes(dayId)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter(d => d !== dayId));
      }
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  const handleCreateSeries = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await api.createRecurringSeries({
        vehicleCategoryId,
        pickupLat,
        pickupLng,
        pickupAddress,
        destinationLat,
        destinationLng,
        destinationAddress,
        pickupTime,
        daysOfWeek: selectedDays,
        startDate,
        endDate
      });
      if (res.success) {
        setSuccessMsg('Recurring commuter series scheduled successfully!');
        loadSeries();
        setTimeout(() => {
          setSuccessMsg('');
          setActiveTab('MY_SERIES');
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to schedule recurring series.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipDate = async (seriesId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const dateToSkip = prompt('Enter date to skip (YYYY-MM-DD):', today);
    if (!dateToSkip) return;
    try {
      await api.skipRecurringDate(seriesId, dateToSkip);
      alert(`Date ${dateToSkip} skipped successfully without canceling the series.`);
      loadSeries();
    } catch (err: any) {
      alert(err.message || 'Failed to skip date');
    }
  };

  const handleToggleStatus = async (seriesId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await api.updateRecurringStatus(seriesId, nextStatus);
      loadSeries();
    } catch (err: any) {
      alert(err.message || 'Failed to update series status');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <Repeat className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Daily Commute & Recurring Rides</h3>
              <p className="text-xs text-slate-400">Scheduled office, college & routine repeat routes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-2 gap-2">
          <button
            onClick={() => setActiveTab('MY_SERIES')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'MY_SERIES'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Repeat className="w-4 h-4" />
            <span>My Commute Schedules ({seriesList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('CREATE_SERIES')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'CREATE_SERIES'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Setup New Schedule</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'CREATE_SERIES' ? (
            <form onSubmit={handleCreateSeries} className="space-y-4">
              {successMsg && (
                <div className="p-3.5 bg-emerald-950/80 border border-emerald-500 rounded-2xl flex items-center space-x-2.5 text-emerald-300 text-xs font-bold">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}
              {errorMsg && (
                <div className="p-3.5 bg-rose-950/80 border border-rose-500 rounded-2xl flex items-center space-x-2.5 text-rose-300 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Pickup & Destination */}
              <div className="space-y-3 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Daily Pickup Location</label>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                    <input
                      type="text"
                      value={pickupAddress}
                      onChange={e => setPickupAddress(e.target.value)}
                      className="w-full bg-transparent text-white font-medium text-xs focus:outline-none"
                      required
                    />
                  </div>
                </div>
                <div className="border-t border-slate-800 pt-3">
                  <label className="block text-xs font-bold text-slate-400 mb-1">Daily Destination / Office</label>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                    <input
                      type="text"
                      value={destinationAddress}
                      onChange={e => setDestinationAddress(e.target.value)}
                      className="w-full bg-transparent text-white font-medium text-xs focus:outline-none"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Vehicle Category */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Vehicle Preference</label>
                <div className="grid grid-cols-3 gap-2">
                  {categories.slice(0, 3).map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setVehicleCategoryId(cat.id)}
                      className={`p-3 rounded-2xl border text-center transition-all ${
                        vehicleCategoryId === cat.id
                          ? 'bg-emerald-600/30 border-emerald-500 text-white font-bold ring-2 ring-emerald-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <p className="text-xs font-black">{cat.name}</p>
                      <p className="text-[10px] text-emerald-400 mt-0.5">₹{cat.base_fare} Base</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Days of Week Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Repeating Days</label>
                <div className="flex gap-1.5">
                  {weekDays.map(d => {
                    const isSelected = selectedDays.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDay(d.id)}
                        className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time & Dates */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Pickup Time</label>
                  <input
                    type="time"
                    value={pickupTime}
                    onChange={e => setPickupTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-600/30 transition-transform active:scale-98 disabled:opacity-50"
              >
                {submitting ? 'Scheduling Routine...' : 'Schedule Commuter Series'}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              {loading ? (
                <div className="p-8 text-center space-y-2">
                  <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
                  <p className="text-xs text-slate-400">Loading recurring schedules...</p>
                </div>
              ) : seriesList.length === 0 ? (
                <div className="p-8 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-2">
                  <Repeat className="w-10 h-10 text-slate-600 mx-auto" />
                  <h4 className="font-bold text-sm text-slate-300">No Recurring Rides Scheduled</h4>
                  <p className="text-xs text-slate-500">Set up repeat rides for office, school, or routine commute without rebooking daily.</p>
                </div>
              ) : (
                seriesList.map(s => (
                  <div key={s.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-sm text-white">{s.pickup_time} AM/PM</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            s.status === 'ACTIVE'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}>
                            {s.status}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md">
                            {s.vehicle_category_name || 'Auto/Sedan'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1 mt-1 text-[11px] font-bold text-emerald-400">
                          {s.days_of_week.map(d => (
                            <span key={d} className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{d}</span>
                          ))}
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <span className="text-xs font-bold text-emerald-400">₹{s.contracted_fare || 180}/ride</span>
                        <p className="text-[10px] text-slate-500">Until {s.end_date}</p>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-slate-300">
                      <p className="truncate">🟢 {s.pickup_address}</p>
                      <p className="truncate">🔴 {s.destination_address}</p>
                    </div>

                    {s.skipped_dates && s.skipped_dates.length > 0 && (
                      <p className="text-[10px] text-amber-400 font-semibold">
                        Skipped Dates: {s.skipped_dates.join(', ')}
                      </p>
                    )}

                    <div className="flex items-center space-x-2 pt-2 border-t border-slate-900">
                      <button
                        onClick={() => handleSkipDate(s.id)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-xl text-xs font-bold border border-slate-800 flex items-center space-x-1"
                      >
                        <CalendarX className="w-3.5 h-3.5" />
                        <span>Skip Next Date</span>
                      </button>

                      <button
                        onClick={() => handleToggleStatus(s.id, s.status)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold border border-slate-800 flex items-center space-x-1"
                      >
                        {s.status === 'ACTIVE' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                        <span>{s.status === 'ACTIVE' ? 'Pause Series' : 'Resume Series'}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
