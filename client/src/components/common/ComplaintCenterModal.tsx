import React, { useState, useEffect } from 'react';
import { User, Complaint, Booking } from '../../types/index.js';
import { api } from '../../services/api.js';
import {
  AlertTriangle,
  X,
  FileText,
  Clock,
  CheckCircle2,
  ShieldAlert,
  Car,
  User as UserIcon,
  HelpCircle,
  CreditCard,
  Send,
  RefreshCw,
  Search,
  MessageSquare
} from 'lucide-react';

interface ComplaintCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  preselectedBooking?: Booking | null;
}

export const ComplaintCenterModal: React.FC<ComplaintCenterModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  preselectedBooking
}) => {
  const [activeTab, setActiveTab] = useState<'NEW_COMPLAINT' | 'MY_TICKETS'>('NEW_COMPLAINT');
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [myComplaints, setMyComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Form State
  const [targetType, setTargetType] = useState<'DRIVER' | 'PASSENGER' | 'RIDE' | 'FARE' | 'SAFETY' | 'APP'>(
    currentUser.role === 'DRIVER' ? 'PASSENGER' : 'DRIVER'
  );
  const [selectedBookingId, setSelectedBookingId] = useState<string>(preselectedBooking?.id || '');
  const [category, setCategory] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      if (preselectedBooking) {
        setSelectedBookingId(preselectedBooking.id);
        if (currentUser.role === 'PASSENGER') {
          setTargetType('DRIVER');
        } else {
          setTargetType('PASSENGER');
        }
      }
    }
  }, [isOpen, preselectedBooking]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [bookingsRes, complaintsRes] = await Promise.all([
        api.getRecentBookings(),
        api.getMyComplaints()
      ]);
      if (bookingsRes.bookings) setRecentBookings(bookingsRes.bookings);
      if (complaintsRes.complaints) setMyComplaints(complaintsRes.complaints);
    } catch (err) {
      console.warn('Error loading complaints/bookings data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoriesForTarget = () => {
    if (targetType === 'DRIVER') {
      return [
        { id: 'RASH_DRIVING', label: '🚗 Dangerous / Rash Driving' },
        { id: 'OVERCHARGING', label: '💸 Demanded Extra Cash / Overcharging' },
        { id: 'WRONG_ROUTE', label: '🧭 Unnecessary Route Deviation' },
        { id: 'AC_REFUSED', label: '❄️ AC Refused / Broken' },
        { id: 'UNHYGIENIC_VEHICLE', label: '🧼 Unclean / Smelly Vehicle' },
        { id: 'RUDE_BEHAVIOR', label: '🗣️ Inappropriate / Rude Behavior' },
        { id: 'MISSED_PICKUP', label: '⏳ Did not come to Pickup Point' }
      ];
    } else if (targetType === 'PASSENGER') {
      return [
        { id: 'PASSENGER_MISBEHAVIOR', label: '🗣️ Rude / Abusive Behavior' },
        { id: 'DELAYED_AT_PICKUP', label: '⏳ Made Captain Wait 10+ Mins' },
        { id: 'VEHICLE_SOILING', label: '🧼 Soiled / Damaged Vehicle Interior' },
        { id: 'FARE_REFUSAL', label: '💸 Refused to Pay Final Fare' },
        { id: 'UNSAFE_REQUEST', label: '⚠️ Asked for Illegal / Overloaded Ride' }
      ];
    } else if (targetType === 'FARE' || targetType === 'RIDE') {
      return [
        { id: 'INCORRECT_FARE_CALCULATION', label: '💰 Incorrect Fare Calculation' },
        { id: 'SURGE_DISPUTE', label: '⚡ Unfair Surge Price Applied' },
        { id: 'DOUBLE_DEBIT', label: '💳 Payment Deducted Twice' },
        { id: 'PROMO_NOT_APPLIED', label: '🏷️ Discount / Coupon Not Applied' }
      ];
    } else if (targetType === 'SAFETY') {
      return [
        { id: 'HARASSMENT', label: '🚨 Verbal / Physical Harassment' },
        { id: 'INTOXICATED_DRIVER_OR_RIDER', label: '🍺 Intoxicated Driver / Passenger' },
        { id: 'VEHICLE_SAFETY_DEFECT', label: '⚠️ Faulty Brakes / Seatbelts' },
        { id: 'UNSAFE_DROP_LOCATION', label: '📍 Dropped in Dangerous Location' }
      ];
    } else {
      return [
        { id: 'APP_GLITCH', label: '📱 App Crashes / GPS Inaccuracy' },
        { id: 'OTP_ERROR', label: '🔢 OTP / PIN Handshake Failure' },
        { id: 'OTHER', label: '❓ Other General Grievance' }
      ];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !title.trim() || !description.trim()) {
      setErrorMessage('Please select a category, enter a summary title, and provide details.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await api.createComplaint({
        bookingId: selectedBookingId || undefined,
        targetType,
        category,
        title: title.trim(),
        description: description.trim(),
        severity
      });

      setSuccessMessage(`Ticket #${res.ticketNumber} created! Our resolution team is on it.`);
      setTitle('');
      setDescription('');
      setCategory('');

      // Refresh ticket list and switch to My Tickets tab
      loadInitialData();
      setTimeout(() => {
        setActiveTab('MY_TICKETS');
        setSuccessMessage('');
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit grievance ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">AditiRide Grievance & Support Center</h2>
              <p className="text-xs text-slate-400 font-medium">Report issues about rides, captains, passengers, or fares</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-6 pt-3">
          <button
            onClick={() => setActiveTab('NEW_COMPLAINT')}
            className={`pb-3 px-4 text-xs font-extrabold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'NEW_COMPLAINT'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>File New Grievance</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('MY_TICKETS');
              loadInitialData();
            }}
            className={`pb-3 px-4 text-xs font-extrabold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'MY_TICKETS'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>My Support Tickets ({myComplaints.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'NEW_COMPLAINT' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Alert Feedback */}
              {errorMessage && (
                <div className="p-3.5 bg-rose-950/60 border border-rose-700/60 rounded-2xl text-rose-300 text-xs font-bold flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
              {successMessage && (
                <div className="p-3.5 bg-emerald-950/60 border border-emerald-700/60 rounded-2xl text-emerald-300 text-xs font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Step 1: Target Entity */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">What is this complaint regarding?</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'DRIVER', label: 'Captain', icon: Car, disabled: currentUser.role === 'DRIVER' },
                    { id: 'PASSENGER', label: 'Passenger', icon: UserIcon, disabled: currentUser.role === 'PASSENGER' },
                    { id: 'RIDE', label: 'Ride / Route', icon: HelpCircle },
                    { id: 'FARE', label: 'Billing / Fare', icon: CreditCard },
                    { id: 'SAFETY', label: 'Safety Concern', icon: ShieldAlert }
                  ].map(t => {
                    const Icon = t.icon;
                    if (t.disabled) return null;
                    const isSelected = targetType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setTargetType(t.id as any);
                          setCategory('');
                        }}
                        className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center space-y-1.5 transition-all ${
                          isSelected
                            ? 'bg-brand-950/70 border-brand-500 text-brand-300 shadow-md shadow-brand-500/10'
                            : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-[11px] font-bold">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Trip Association (Optional / Selectable) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Associated Ride (Optional)</label>
                <select
                  value={selectedBookingId}
                  onChange={e => setSelectedBookingId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-brand-500 font-medium"
                >
                  <option value="">General Issue (Not related to a specific trip)</option>
                  {recentBookings.map(b => (
                    <option key={b.id} value={b.id}>
                      #{b.booking_number} • {new Date(b.created_at).toLocaleDateString()} • {b.pickup_address} ➔ {b.destination_address} (₹{b.final_fare || b.fare_estimate})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 3: Grievance Category */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Specific Issue Category *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {getCategoriesForTarget().map(c => {
                    const isSelected = category === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategory(c.id)}
                        className={`p-3 text-left rounded-2xl border text-xs font-bold transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-brand-950/60 border-brand-500 text-brand-300'
                            : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span>{c.label}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-brand-400 flex-shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 4: Severity & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Summary Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Captain demanded ₹100 extra in cash"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-brand-500 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Urgency Level</label>
                  <select
                    value={severity}
                    onChange={e => setSeverity(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-brand-500 font-bold"
                  >
                    <option value="LOW">Low Priority</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High Priority</option>
                    <option value="CRITICAL">🚨 Critical / Safety</option>
                  </select>
                </div>
              </div>

              {/* Step 5: Detailed Description */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Detailed Description & Evidence *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe what happened with clear details (location, timing, behavior, fare disputes)..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-brand-500 resize-none font-medium"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white rounded-2xl font-extrabold text-sm shadow-xl shadow-rose-600/25 transition-transform active:scale-98 flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting Ticket...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Register Official Grievance Ticket</span>
                  </>
                )}
              </button>

            </form>
          ) : (
            /* My Tickets Tab */
            <div className="space-y-3">
              {isLoading ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-400" />
                  Loading your registered grievances...
                </div>
              ) : myComplaints.length === 0 ? (
                <div className="p-8 bg-slate-950/40 rounded-3xl border border-slate-800 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <h4 className="text-sm font-bold text-white">No complaints filed</h4>
                  <p className="text-xs text-slate-400">You have zero open or unresolved support tickets.</p>
                </div>
              ) : (
                myComplaints.map(ticket => {
                  const isResolved = ticket.status === 'RESOLVED';
                  const isUnderReview = ticket.status === 'UNDER_REVIEW';
                  return (
                    <div
                      key={ticket.id}
                      className="p-5 bg-slate-950/60 border border-slate-800 hover:border-slate-700 rounded-2xl space-y-2.5 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono font-black text-brand-400 bg-brand-950 px-2.5 py-0.5 rounded-lg border border-brand-800">
                            #{ticket.ticket_number}
                          </span>
                          <span className="text-[11px] font-bold text-slate-300">
                            {ticket.category.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                            isResolved
                              ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700'
                              : isUnderReview
                              ? 'bg-amber-950/80 text-amber-400 border-amber-700'
                              : 'bg-rose-950/80 text-rose-400 border-rose-700'
                          }`}
                        >
                          {ticket.status}
                        </span>
                      </div>

                      <h4 className="text-xs font-extrabold text-white">{ticket.title}</h4>
                      <p className="text-xs text-slate-400 font-medium">{ticket.description}</p>

                      {ticket.booking_number && (
                        <div className="text-[11px] text-slate-500 font-medium">
                          Associated Ride: #{ticket.booking_number}
                        </div>
                      )}

                      {ticket.resolution_notes && (
                        <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs space-y-1">
                          <p className="font-bold text-emerald-400">Resolution by Support Admin:</p>
                          <p className="text-slate-300 text-[11px]">{ticket.resolution_notes}</p>
                          {ticket.resolved_at && (
                            <p className="text-[10px] text-slate-500">
                              Resolved on {new Date(ticket.resolved_at).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="text-[10px] text-slate-500 pt-1 flex items-center justify-between border-t border-slate-900">
                        <span>Filed on {new Date(ticket.created_at).toLocaleDateString()}</span>
                        <span className="capitalize font-semibold text-slate-400">Severity: {ticket.severity}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
