import React, { useState, useEffect } from 'react';
import { User, LanguageCode } from '../../types/index.js';
import { api } from '../../services/api.js';
import { Calendar, Clock, MapPin, Plus, Trash2, ArrowRight, ShieldCheck } from 'lucide-react';

interface ScheduledRidesViewProps {
  currentUser: User;
  language: LanguageCode;
}

export const ScheduledRidesView: React.FC<ScheduledRidesViewProps> = ({ currentUser, language }) => {
  const [scheduledRides, setScheduledRides] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [destinationAddress, setDestinationAddress] = useState('Cochin International Airport (COK)');
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [recurrenceRule, setRecurrenceRule] = useState('NONE');

  const loadScheduled = async () => {
    try {
      const res = await api.getScheduledRides(currentUser.id);
      setScheduledRides(res.scheduled || []);
    } catch (err) {
      console.error('Failed to load scheduled rides:', err);
    }
  };

  useEffect(() => {
    loadScheduled();
  }, [currentUser.id]);

  const handleCreateSchedule = async () => {
    if (!scheduledDateTime) {
      alert('Please select a pickup date and time');
      return;
    }

    try {
      await api.createScheduledRide({
        passengerId: currentUser.id,
        pickupLat: 10.5276,
        pickupLng: 76.2144,
        pickupAddress: 'Swaraj Round, Thrissur',
        destinationLat: 10.1518,
        destinationLng: 76.3930,
        destinationAddress,
        scheduledTime: scheduledDateTime,
        recurrenceRule: recurrenceRule !== 'NONE' ? recurrenceRule : undefined,
        vehicleCategoryId: 'cat_sedan'
      });
      setShowCreateModal(false);
      loadScheduled();
      alert('Ride scheduled successfully! You will receive reminder alerts before departure.');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-5">
      
      <div className="flex items-center justify-between p-5 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Scheduled & Recurring Rides</h2>
          <p className="text-xs text-slate-500">Book up to 30 days ahead with guaranteed favorite driver matching.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold text-xs shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule New Ride</span>
        </button>
      </div>

      {/* List of Scheduled Bookings */}
      <div className="space-y-3">
        {scheduledRides.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-2">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">No scheduled rides yet</h3>
            <p className="text-xs text-slate-400">Planning an airport or morning office trip? Schedule in seconds.</p>
          </div>
        ) : (
          scheduledRides.map(ride => (
            <div
              key={ride.id}
              className="p-5 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                    {ride.status}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">{ride.vehicle_category_name || 'Sedan'}</span>
                </div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {ride.pickup_address.split(',')[0]} → {ride.destination_address.split(',')[0]}
                </h4>
                <div className="flex items-center space-x-3 text-xs text-slate-500">
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-brand-600" />
                    <span>{new Date(ride.scheduled_time).toLocaleString()}</span>
                  </span>
                  {ride.recurrence_rule && (
                    <span className="font-semibold text-brand-600">Recurring: {ride.recurrence_rule}</span>
                  )}
                </div>
              </div>

              <button className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-bold">
                Cancel
              </button>
            </div>
          ))
        )}
      </div>

      {/* Schedule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Schedule a Future Ride</h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Destination</label>
                <input
                  type="text"
                  value={destinationAddress}
                  onChange={e => setDestinationAddress(e.target.value)}
                  className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl font-medium text-xs border focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={e => setScheduledDateTime(e.target.value)}
                  className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl font-medium text-xs border focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Recurrence Rule</label>
                <select
                  value={recurrenceRule}
                  onChange={e => setRecurrenceRule(e.target.value)}
                  className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl font-medium text-xs border focus:ring-2 focus:ring-brand-500"
                >
                  <option value="NONE">One-time ride only</option>
                  <option value="WEEKDAYS_8_30">Every Weekday (Mon-Fri 8:30 AM)</option>
                  <option value="WEEKENDS">Every Weekend</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold"
              >
                Close
              </button>
              <button
                onClick={handleCreateSchedule}
                className="py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md"
              >
                Confirm Schedule
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
