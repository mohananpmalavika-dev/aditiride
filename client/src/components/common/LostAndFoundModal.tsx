import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { User, LostAndFoundItem, LostItemCategory } from '../../types/index.js';
import {
  PackageSearch,
  CheckCircle,
  Clock,
  Phone,
  AlertCircle,
  X,
  Plus,
  ShieldCheck,
  Smartphone,
  Briefcase,
  Wallet,
  Key,
  FileText,
  HelpCircle,
  Car
} from 'lucide-react';

interface LostAndFoundModalProps {
  currentUser: User;
  onClose: () => void;
  recentBookingId?: string;
}

export const LostAndFoundModal: React.FC<LostAndFoundModalProps> = ({
  currentUser,
  onClose,
  recentBookingId
}) => {
  const [activeTab, setActiveTab] = useState<'MY_ITEMS' | 'REPORT_NEW'>('MY_ITEMS');
  const [items, setItems] = useState<LostAndFoundItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Report Form State
  const [bookingId, setBookingId] = useState(recentBookingId || '');
  const [itemCategory, setItemCategory] = useState<LostItemCategory>('BAG');
  const [itemDescription, setItemDescription] = useState('');
  const [contactPhone, setContactPhone] = useState(currentUser.phone || '');
  const [returnFee, setReturnFee] = useState(150);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadLostItems();
  }, []);

  const loadLostItems = async () => {
    setLoading(true);
    try {
      const res = await api.getMyLostItems();
      if (res.items) setItems(res.items);
    } catch (e) {
      console.warn('Failed to load lost items:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleReportLostItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingId || !itemDescription.trim() || !contactPhone.trim()) {
      setErrorMsg('Please enter Booking ID, item description and contact phone.');
      return;
    }
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await api.reportLostItem({
        bookingId,
        itemCategory,
        itemDescription,
        contactPhone,
        returnFee
      });
      if (res.success) {
        setSuccessMsg('Lost item reported! Captain & Support team have been alerted.');
        setItemDescription('');
        loadLostItems();
        setTimeout(() => {
          setSuccessMsg('');
          setActiveTab('MY_ITEMS');
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDriverUpdateStatus = async (itemId: string, newStatus: string, notes?: string) => {
    try {
      await api.updateLostItemStatus(itemId, { status: newStatus, driverNotes: notes });
      loadLostItems();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'PHONE': return <Smartphone className="w-5 h-5 text-sky-400" />;
      case 'BAG': return <Briefcase className="w-5 h-5 text-amber-400" />;
      case 'WALLET': return <Wallet className="w-5 h-5 text-emerald-400" />;
      case 'KEYS': return <Key className="w-5 h-5 text-rose-400" />;
      case 'DOCUMENTS': return <FileText className="w-5 h-5 text-indigo-400" />;
      default: return <HelpCircle className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center">
              <PackageSearch className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Lost & Found Support Desk</h3>
              <p className="text-xs text-slate-400">Recover belongings left in AditiRide vehicles</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-2 gap-2">
          <button
            onClick={() => setActiveTab('MY_ITEMS')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'MY_ITEMS'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <PackageSearch className="w-4 h-4" />
            <span>Active Cases ({items.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('REPORT_NEW')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'REPORT_NEW'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Report Lost Item</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'REPORT_NEW' ? (
            <form onSubmit={handleReportLostItem} className="space-y-4">
              
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

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Ride Booking ID / Number</label>
                <input
                  type="text"
                  value={bookingId}
                  onChange={e => setBookingId(e.target.value)}
                  placeholder="e.g. bk_sample_past_1 or ADITI-2026-8910"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Item Category</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { id: 'PHONE', label: 'Phone', icon: Smartphone },
                    { id: 'BAG', label: 'Bag / Purse', icon: Briefcase },
                    { id: 'WALLET', label: 'Wallet', icon: Wallet },
                    { id: 'KEYS', label: 'Keys', icon: Key },
                    { id: 'DOCUMENTS', label: 'Docs / ID', icon: FileText },
                    { id: 'OTHER', label: 'Other', icon: HelpCircle }
                  ].map(cat => {
                    const Icon = cat.icon;
                    const isSelected = itemCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setItemCategory(cat.id as LostItemCategory)}
                        className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center space-y-1 transition-all ${
                          isSelected
                            ? 'bg-indigo-600/30 border-indigo-500 text-white font-bold ring-2 ring-indigo-500/40'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-[11px]">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Detailed Description</label>
                <textarea
                  rows={3}
                  value={itemDescription}
                  onChange={e => setItemDescription(e.target.value)}
                  placeholder="Describe color, brand, contents, where in vehicle it was left..."
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Contact Phone</label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Driver Return Reward (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={returnFee}
                    onChange={e => setReturnFee(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-emerald-400 font-mono font-bold text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500">Compensates driver fuel/time on return</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/30 transition-transform active:scale-98 disabled:opacity-50"
              >
                {submitting ? 'Submitting Case...' : 'Submit Lost Item Case'}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              {loading ? (
                <div className="p-8 text-center space-y-2">
                  <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
                  <p className="text-xs text-slate-400">Loading lost & found cases...</p>
                </div>
              ) : items.length === 0 ? (
                <div className="p-8 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-2">
                  <PackageSearch className="w-10 h-10 text-slate-600 mx-auto" />
                  <h4 className="font-bold text-sm text-slate-300">No Reported Lost Items</h4>
                  <p className="text-xs text-slate-500">You have no active lost item cases on file.</p>
                </div>
              ) : (
                items.map(item => (
                  <div key={item.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                          {getCategoryIcon(item.item_category)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-black text-white">{item.item_category}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              item.status === 'RESOLVED'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : item.status === 'ITEM_FOUND'
                                ? 'bg-sky-950 text-sky-300 border border-sky-800 animate-pulse'
                                : 'bg-amber-950 text-amber-300 border border-amber-800'
                            }`}>
                              {item.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{item.item_description}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 font-mono">Ride #{item.booking_number || item.booking_id}</span>
                        <p className="text-xs font-bold text-emerald-400">Return Fee: ₹{item.return_fee}</p>
                      </div>
                    </div>

                    {item.driver_notes && (
                      <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-300">
                        <span className="text-slate-500 font-bold">Driver Note: </span>
                        {item.driver_notes}
                      </div>
                    )}

                    {/* Driver action buttons if current user is driver */}
                    {currentUser.role === 'DRIVER' && item.status !== 'RESOLVED' && (
                      <div className="flex items-center space-x-2 pt-2 border-t border-slate-900">
                        <button
                          onClick={() => handleDriverUpdateStatus(item.id, 'ITEM_FOUND', 'Item secured safely by Captain')}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-colors"
                        >
                          Found Item in Car
                        </button>
                        <button
                          onClick={() => handleDriverUpdateStatus(item.id, 'RESOLVED', 'Item returned to passenger in person')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors"
                        >
                          Mark as Returned (Claim ₹{item.return_fee})
                        </button>
                      </div>
                    )}
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
