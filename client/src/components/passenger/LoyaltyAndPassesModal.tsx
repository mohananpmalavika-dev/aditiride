import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { User, RidePass, UserRidePass } from '../../types/index.js';
import {
  Award,
  Ticket,
  Users,
  CheckCircle,
  Clock,
  Sparkles,
  Share2,
  Copy,
  Zap,
  Star,
  Shield,
  X,
  CreditCard,
  ChevronRight
} from 'lucide-react';

interface LoyaltyAndPassesModalProps {
  currentUser: User;
  onClose: () => void;
  onWalletUpdated?: () => void;
}

export const LoyaltyAndPassesModal: React.FC<LoyaltyAndPassesModalProps> = ({
  currentUser,
  onClose,
  onWalletUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'TIER' | 'PASSES' | 'REFERRALS'>('TIER');
  
  // Loyalty State
  const [loyaltyData, setLoyaltyData] = useState<any>(null);
  const [passes, setPasses] = useState<RidePass[]>([]);
  const [userPasses, setUserPasses] = useState<UserRidePass[]>([]);
  const [referralData, setReferralData] = useState<any>(null);
  const [inputRefCode, setInputRefCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [lRes, pRes, upRes, rRes] = await Promise.all([
        api.getLoyaltyStatus(),
        api.getRidePasses(),
        api.getUserRidePasses(),
        api.getReferrals()
      ]);
      if (lRes) setLoyaltyData(lRes);
      if (pRes?.passes) setPasses(pRes.passes);
      if (upRes?.userPasses) setUserPasses(upRes.userPasses);
      if (rRes) setReferralData(rRes);
    } catch (e) {
      console.warn('Failed to load loyalty/pass data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyPass = async (passId: string) => {
    setActionSuccess('');
    setActionError('');
    try {
      const res = await api.buyRidePass(passId);
      if (res.success) {
        setActionSuccess(res.message);
        loadAllData();
        onWalletUpdated?.();
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to buy pass');
    }
  };

  const handleApplyReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputRefCode.trim()) return;
    setActionSuccess('');
    setActionError('');
    try {
      const res = await api.applyReferral(inputRefCode.trim());
      if (res.success) {
        setActionSuccess(res.message);
        setInputRefCode('');
        loadAllData();
        onWalletUpdated?.();
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to apply referral code');
    }
  };

  const copyReferralCode = () => {
    const code = referralData?.referralCode || loyaltyData?.referralCode || 'ADITI-2026';
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareReferralWhatsApp = () => {
    const code = referralData?.referralCode || loyaltyData?.referralCode || 'ADITI-2026';
    const text = `Join me on AditiRide! Use my referral code ${code} for ₹100 FREE ride wallet balance: https://aditiride.com/signup?ref=${code}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-600/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Loyalty Tiers, Passes & Rewards</h3>
              <p className="text-xs text-slate-400">Exclusive rider perks, commute discount packages & referral rewards</p>
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
            onClick={() => setActiveTab('TIER')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'TIER'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>My VIP Tier ({loyaltyData?.tier || 'BRONZE'})</span>
          </button>
          <button
            onClick={() => setActiveTab('PASSES')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'PASSES'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>Ride Passes ({userPasses.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('REFERRALS')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 ${
              activeTab === 'REFERRALS'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Refer & Earn (₹100)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          
          {actionSuccess && (
            <div className="p-3.5 bg-emerald-950/80 border border-emerald-500 rounded-2xl flex items-center space-x-2.5 text-emerald-300 text-xs font-bold animate-in zoom-in-95">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {actionError && (
            <div className="p-3.5 bg-rose-950/80 border border-rose-500 rounded-2xl flex items-center space-x-2.5 text-rose-300 text-xs font-bold animate-in zoom-in-95">
              <Sparkles className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* TAB 1: VIP TIER */}
          {activeTab === 'TIER' && (
            <div className="space-y-4">
              
              {/* Tier Glowing Card */}
              <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/40 rounded-3xl border-2 border-amber-500/40 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-lg">
                      ★
                    </div>
                    <div>
                      <p className="text-[11px] font-extrabold uppercase text-amber-400 tracking-wider">AditiRide Club Member</p>
                      <h3 className="text-xl font-black text-white">{loyaltyData?.tier || 'BRONZE'} TIER</h3>
                    </div>
                  </div>

                  <span className="text-xs font-bold text-amber-300 bg-amber-950/80 px-3 py-1 rounded-full border border-amber-700">
                    {loyaltyData?.completedTripsCount || 0} Rides Completed
                  </span>
                </div>

                {/* Progress to Next Tier */}
                {loyaltyData?.nextTierTrips > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-400">Progress to Next Tier</span>
                      <span className="text-amber-400">{loyaltyData.nextTierTrips} more rides needed</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
                        style={{ width: `${Math.min(100, (loyaltyData.completedTripsCount / (loyaltyData.completedTripsCount + loyaltyData.nextTierTrips)) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Tier Perks Checklist */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">Your Active Tier Benefits</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {loyaltyData?.perks?.map((perk: string, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center space-x-2.5">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-bold text-slate-200">{perk}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: RIDE PASSES */}
          {activeTab === 'PASSES' && (
            <div className="space-y-4">
              
              {/* Active User Passes */}
              {userPasses.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider">My Active Commute Passes</h4>
                  <div className="grid grid-cols-1 gap-2.5">
                    {userPasses.map(up => (
                      <div key={up.id} className="p-4 bg-gradient-to-r from-emerald-950/40 via-slate-950 to-emerald-950/40 border border-emerald-500/50 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Ticket className="w-6 h-6 text-emerald-400" />
                          <div>
                            <h5 className="font-extrabold text-sm text-white">{up.pass_name}</h5>
                            <p className="text-xs text-emerald-300 font-medium">
                              Save ₹{up.discount_per_ride}/ride • <span className="font-bold text-white">{up.rides_remaining} Rides Left</span>
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">Expires {up.expires_at.split('T')[0]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Store Passes */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">Buy Commuter Saver Packages</h4>
                <div className="grid grid-cols-1 gap-3">
                  {passes.map(p => (
                    <div key={p.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between hover:border-slate-700 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-sm text-white">{p.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {p.total_rides} Rides
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 max-w-sm">{p.description}</p>
                        <p className="text-xs font-bold text-emerald-400">Save ₹{p.discount_per_ride} on every trip</p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-lg font-black text-white font-mono">₹{p.price}</p>
                        <button
                          onClick={() => handleBuyPass(p.id)}
                          className="mt-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition-transform active:scale-95 flex items-center space-x-1"
                        >
                          <span>Buy with Wallet</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: REFER & EARN */}
          {activeTab === 'REFERRALS' && (
            <div className="space-y-4">
              
              {/* Referral Banner */}
              <div className="p-5 bg-gradient-to-br from-indigo-950/60 via-slate-950 to-indigo-950/60 border border-indigo-500/50 rounded-3xl text-center space-y-3 shadow-xl">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-lg">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">Give ₹100, Get ₹100</h3>
                  <p className="text-xs text-indigo-300 max-w-md mx-auto mt-0.5">
                    Share your code with friends & family. When they complete their first ride, you both get ₹100 in your AditiRide wallet!
                  </p>
                </div>

                {/* Code Copy Box */}
                <div className="max-w-xs mx-auto flex items-center justify-between p-2.5 bg-slate-900 border-2 border-dashed border-indigo-500 rounded-2xl">
                  <span className="font-mono font-black text-base text-white tracking-widest px-2">
                    {referralData?.referralCode || loyaltyData?.referralCode || 'ADITI-2026'}
                  </span>
                  <button
                    onClick={copyReferralCode}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>

                {/* WhatsApp Share */}
                <button
                  onClick={shareReferralWhatsApp}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-md transition-transform active:scale-95 inline-flex items-center space-x-2"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share on WhatsApp</span>
                </button>
              </div>

              {/* Apply Referral Code Form */}
              <form onSubmit={handleApplyReferral} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                <label className="block text-xs font-bold text-slate-300">Have a Friend's Referral Code?</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputRefCode}
                    onChange={e => setInputRefCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ADITI-RAHUL-4512"
                    className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs rounded-xl border border-indigo-500/40 transition-colors"
                  >
                    Apply Code
                  </button>
                </div>
              </form>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
