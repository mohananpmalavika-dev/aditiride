import React, { useState } from 'react';
import { User } from '../../types/index.js';
import {
  UserCheck,
  UserPlus,
  Phone,
  CreditCard,
  Banknote,
  CheckCircle,
  X,
  Share2,
  ShieldCheck
} from 'lucide-react';

interface BookForOtherModalProps {
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onSave: (details: { isBookingForOther: boolean; riderName: string; riderPhone: string; riderPaymentMode: 'BOOKER_PAYS' | 'RIDER_PAYS_CASH' }) => void;
  currentDetails?: {
    isBookingForOther: boolean;
    riderName: string;
    riderPhone: string;
    riderPaymentMode: 'BOOKER_PAYS' | 'RIDER_PAYS_CASH';
  };
}

export const BookForOtherModal: React.FC<BookForOtherModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onSave,
  currentDetails
}) => {
  const [riderName, setRiderName] = useState(currentDetails?.riderName || '');
  const [riderPhone, setRiderPhone] = useState(currentDetails?.riderPhone || '');
  const [riderPaymentMode, setRiderPaymentMode] = useState<'BOOKER_PAYS' | 'RIDER_PAYS_CASH'>(
    currentDetails?.riderPaymentMode || 'BOOKER_PAYS'
  );
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!riderName.trim() || !riderPhone.trim()) {
      setError('Please enter both Rider Name and Contact Phone.');
      return;
    }
    onSave({
      isBookingForOther: true,
      riderName: riderName.trim(),
      riderPhone: riderPhone.trim(),
      riderPaymentMode
    });
    onClose();
  };

  const handleResetToMyself = () => {
    onSave({
      isBookingForOther: false,
      riderName: '',
      riderPhone: '',
      riderPaymentMode: 'BOOKER_PAYS'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Book for Someone Else</h3>
              <p className="text-xs text-slate-400">Family & friends ride booking with live SMS tracking</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleConfirm} className="p-5 space-y-4">
          {error && (
            <p className="text-xs text-rose-400 font-bold bg-rose-950/80 border border-rose-800 p-2.5 rounded-xl text-center">
              {error}
            </p>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Rider's Full Name</label>
            <input
              type="text"
              value={riderName}
              onChange={e => setRiderName(e.target.value)}
              placeholder="e.g. Amma / Rahul / Anand"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Rider's Mobile Number</label>
            <div className="flex items-center space-x-2">
              <span className="px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-400 font-mono text-sm">
                +91
              </span>
              <input
                type="tel"
                value={riderPhone}
                onChange={e => setRiderPhone(e.target.value)}
                placeholder="9847012345"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Captain and PIN details will be sent directly to this number.</p>
          </div>

          {/* Payment Responsibility */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Who Will Pay for the Ride?</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setRiderPaymentMode('BOOKER_PAYS')}
                className={`p-3 rounded-2xl border text-left flex flex-col space-y-1 transition-all ${
                  riderPaymentMode === 'BOOKER_PAYS'
                    ? 'bg-indigo-600/30 border-indigo-500 text-white font-bold ring-2 ring-indigo-500/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <CreditCard className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold">I Will Pay</span>
                </div>
                <span className="text-[10px] text-slate-400">Deduct from my Wallet/UPI</span>
              </button>

              <button
                type="button"
                onClick={() => setRiderPaymentMode('RIDER_PAYS_CASH')}
                className={`p-3 rounded-2xl border text-left flex flex-col space-y-1 transition-all ${
                  riderPaymentMode === 'RIDER_PAYS_CASH'
                    ? 'bg-indigo-600/30 border-indigo-500 text-white font-bold ring-2 ring-indigo-500/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Banknote className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold">Rider Pays Cash</span>
                </div>
                <span className="text-[10px] text-slate-400">Rider pays Captain on drop</span>
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center space-x-2">
            {currentDetails?.isBookingForOther && (
              <button
                type="button"
                onClick={handleResetToMyself}
                className="px-3.5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors"
              >
                Switch to Myself
              </button>
            )}

            <button
              type="submit"
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-transform active:scale-95 flex items-center justify-center space-x-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Confirm & Set Rider</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
