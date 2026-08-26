import React, { useState, useEffect } from 'react';
import { User, LanguageCode } from '../../types/index.js';
import { api } from '../../services/api.js';
import { Clock, MapPin, Download, CheckCircle, XCircle, ArrowRight, Printer } from 'lucide-react';

interface TripHistoryViewProps {
  currentUser: User;
  language: LanguageCode;
  onRebook: (trip: any) => void;
}

export const TripHistoryView: React.FC<TripHistoryViewProps> = ({ currentUser, language, onRebook }) => {
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  useEffect(() => {
    api.getRecentBookings(currentUser.id).then(res => setTrips(res.recent || [])).catch(() => {});
  }, [currentUser.id]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-5">
      
      <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Your Ride History</h2>
        <p className="text-xs text-slate-500">Access invoices, digital receipts, and rebook previous trips with 1-tap.</p>
      </div>

      <div className="space-y-3">
        {trips.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">No ride history yet.</p>
        ) : (
          trips.map(trip => (
            <div
              key={trip.id}
              className="p-5 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    trip.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {trip.status}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400 ml-2">#{trip.booking_number}</span>
                </div>
                <span className="text-base font-black text-slate-900 dark:text-white">
                  ₹{trip.final_fare || trip.fare_estimate}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <p className="font-bold text-slate-900 dark:text-white truncate">
                  {trip.pickup_address.split(',')[0]} → {trip.destination_address.split(',')[0]}
                </p>
                <p className="text-slate-400 text-[11px]">
                  {new Date(trip.created_at).toLocaleString()} • {trip.vehicle_category_display || 'Auto'} • {trip.payment_method}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <button
                  onClick={() => setSelectedInvoice(trip)}
                  className="flex items-center space-x-1 font-bold text-slate-600 dark:text-slate-300 hover:text-brand-600"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>View Digital Receipt</span>
                </button>

                <button
                  onClick={() => onRebook(trip)}
                  className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-xs shadow-sm transition-transform active:scale-95"
                >
                  Book Again
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-left">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Tax Invoice & Digital Receipt</h3>
              <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between font-mono text-[11px] text-slate-500">
                <span>Invoice #: INV-{selectedInvoice.booking_number}</span>
                <span>GSTIN: 32AABCU9603R1ZM</span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <p><b>Driver:</b> {selectedInvoice.driver_name || 'Assigned Driver'}</p>
                <p><b>Vehicle:</b> {selectedInvoice.vehicle_brand || 'Standard'} {selectedInvoice.vehicle_plate || ''}</p>
                <p><b>Distance:</b> {selectedInvoice.distance_km} km • <b>Duration:</b> {selectedInvoice.duration_min} mins</p>
              </div>

              <div className="space-y-1 pt-2 border-t text-xs">
                <div className="flex justify-between"><span>Base & Distance Fare</span><span>₹{selectedInvoice.fare_estimate - 12}</span></div>
                <div className="flex justify-between"><span>Platform & Safety Fee</span><span>₹10.00</span></div>
                <div className="flex justify-between"><span>Taxes (5% GST)</span><span>₹2.00</span></div>
                <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-white pt-1 border-t">
                  <span>Total Settled</span>
                  <span>₹{selectedInvoice.final_fare || selectedInvoice.fare_estimate}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                window.print();
              }}
              className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs"
            >
              Print / Save as PDF
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
