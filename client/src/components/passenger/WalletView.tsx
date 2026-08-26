import React, { useState, useEffect } from 'react';
import { User, LanguageCode } from '../../types/index.js';
import { api } from '../../services/api.js';
import { t } from '../../i18n/translations.js';
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, ShieldCheck } from 'lucide-react';

interface WalletViewProps {
  currentUser: User;
  language: LanguageCode;
  onBalanceUpdated?: (newBalance: number) => void;
}

export const WalletView: React.FC<WalletViewProps> = ({ currentUser, language, onBalanceUpdated }) => {
  const [wallet, setWallet] = useState<any>({ balance: 1250 });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [topUpAmount, setTopUpAmount] = useState('500');
  const [isAdding, setIsAdding] = useState(false);

  const loadWallet = async () => {
    try {
      const res = await api.getWallet(currentUser.id);
      setWallet(res.wallet);
      setTransactions(res.transactions || []);
      if (onBalanceUpdated) onBalanceUpdated(res.wallet.balance);
    } catch (err) {
      console.error('Wallet fetch error:', err);
    }
  };

  useEffect(() => {
    loadWallet();
  }, [currentUser.id]);

  const handleTopUp = async () => {
    const amt = parseFloat(topUpAmount);
    if (!amt || amt <= 0) return;
    setIsAdding(true);
    try {
      const res = await api.topUpWallet(currentUser.id, amt);
      setWallet(res.wallet);
      if (onBalanceUpdated) onBalanceUpdated(res.wallet.balance);
      loadWallet();
      alert(`₹${amt} successfully added to your Aditi Wallet!`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-5">
      
      {/* Wallet Balance Hero Card */}
      <div className="p-6 bg-gradient-to-tr from-brand-700 via-brand-600 to-emerald-500 text-white rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wallet className="w-6 h-6" />
            <span className="font-extrabold text-sm uppercase tracking-wider">AditiRide Digital Wallet</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-semibold">1-Tap Fast Checkout</span>
        </div>

        <div>
          <p className="text-xs text-brand-100 font-medium">Available Balance</p>
          <h2 className="text-4xl font-black tracking-tight mt-1">₹{wallet?.balance || 0}</h2>
        </div>

        {/* Quick Top-Up Bar */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
          <div className="flex items-center space-x-1.5 w-full sm:w-auto">
            {['100', '250', '500', '1000'].map(amt => (
              <button
                key={amt}
                onClick={() => setTopUpAmount(amt)}
                className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  topUpAmount === amt ? 'bg-white text-brand-800 shadow-md' : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                +₹{amt}
              </button>
            ))}
          </div>

          <button
            onClick={handleTopUp}
            disabled={isAdding}
            className="w-full sm:w-auto px-5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-extrabold shadow-md transition-transform active:scale-95"
          >
            {isAdding ? 'Adding Funds...' : `Add ₹${topUpAmount} via UPI`}
          </button>
        </div>
      </div>

      {/* Transaction Statement */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Transaction History</h3>

        {transactions.length === 0 ? (
          <p className="text-xs text-slate-400">No transactions recorded yet.</p>
        ) : (
          <div className="space-y-2.5">
            {transactions.map(tx => {
              const isCredit = tx.type === 'CREDIT';
              return (
                <div
                  key={tx.id}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                        isCredit
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-600'
                      }`}
                    >
                      {isCredit ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{tx.description}</p>
                      <p className="text-[10px] text-slate-400">{tx.created_at}</p>
                    </div>
                  </div>

                  <span className={`font-extrabold text-sm ${isCredit ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>
                    {isCredit ? '+' : '-'}₹{tx.amount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
