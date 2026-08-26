import React from 'react';
import { User, LanguageCode } from '../../types/index.js';
import { t } from '../../i18n/translations.js';
import {
  Compass,
  Globe,
  Wallet,
  LogOut,
  Shield,
  Car,
  UserCheck,
  Truck,
  User as UserIcon
} from 'lucide-react';

interface NavbarProps {
  currentUser: User;
  language: LanguageCode;
  onSelectLanguage: (lang: LanguageCode) => void;
  walletBalance?: number;
  hasActiveTrip?: boolean;
  onNavigateActiveTrip?: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  language,
  onSelectLanguage,
  walletBalance = 500,
  hasActiveTrip = false,
  onNavigateActiveTrip,
  onLogout
}) => {
  const languages: { code: LanguageCode; label: string; native: string }[] = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
    { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
    { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
    { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
    { code: 'te', label: 'Telugu', native: 'తెలుగు' }
  ];

  const getRoleBadge = () => {
    switch (currentUser.role) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return {
          label: 'Admin Control Center',
          icon: Shield,
          color: 'bg-rose-500/10 text-rose-400 border-rose-500/30 ring-1 ring-rose-500/20'
        };
      case 'DRIVER':
        return {
          label: 'Captain Workspace',
          icon: UserCheck,
          color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 ring-1 ring-emerald-500/20'
        };
      case 'FLEET_MANAGER':
        return {
          label: 'Fleet Operations',
          icon: Truck,
          color: 'bg-purple-500/10 text-purple-400 border-purple-500/30 ring-1 ring-purple-500/20'
        };
      default:
        return {
          label: 'Passenger Portal',
          icon: Car,
          color: 'bg-brand-500/10 text-brand-400 border-brand-500/30 ring-1 ring-brand-500/20'
        };
    }
  };

  const roleInfo = getRoleBadge();
  const RoleIcon = roleInfo.icon;

  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo & Current Workspace Badge */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg text-white tracking-tight">
                  AditiRide
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center space-x-1 ${roleInfo.color}`}>
                  <RoleIcon className="w-3 h-3" />
                  <span>{roleInfo.label}</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium hidden sm:block">
                Universal Multi-Modal Mobility
              </p>
            </div>
          </div>

          {/* Right Tools: Language, Wallet (Passenger only), Active Ride, User Profile, Sign Out */}
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            
            {/* Active Ride Badge */}
            {hasActiveTrip && onNavigateActiveTrip && (
              <button
                onClick={onNavigateActiveTrip}
                className="flex items-center space-x-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-xs font-bold animate-pulse"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Active Ride</span>
              </button>
            )}

            {/* Passenger Wallet Badge */}
            {currentUser.role === 'PASSENGER' && (
              <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs font-bold text-emerald-300 shadow-sm">
                <Wallet className="w-3.5 h-3.5" />
                <span>₹{walletBalance}</span>
              </div>
            )}

            {/* Language Selector */}
            <div className="relative group">
              <button className="flex items-center space-x-1 p-2 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors text-xs font-bold border border-slate-800">
                <Globe className="w-4 h-4 text-brand-400" />
                <span className="uppercase">{language}</span>
              </button>
              
              <div className="absolute right-0 mt-1 w-44 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 py-1 hidden group-hover:block z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Select Language
                </div>
                {languages.map(l => (
                  <button
                    key={l.code}
                    onClick={() => onSelectLanguage(l.code)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-800/80 ${
                      language === l.code ? 'font-bold text-brand-400' : 'text-slate-300'
                    }`}
                  >
                    <span>{l.label}</span>
                    <span className="text-[11px] text-slate-500">{l.native}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* User Profile Pill & Dropdown */}
            <div className="relative group">
              <button className="flex items-center space-x-2 p-1.5 pl-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs font-semibold">
                <img
                  src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                  alt={currentUser.name}
                  className="w-6 h-6 rounded-full object-cover ring-1 ring-brand-500"
                />
                <span className="hidden sm:inline-block max-w-[120px] truncate text-slate-200">
                  {currentUser.name.split(' ')[0]}
                </span>
              </button>

              <div className="absolute right-0 mt-1 w-56 bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 py-2 hidden group-hover:block z-50">
                <div className="px-4 py-2 border-b border-slate-800 space-y-0.5">
                  <p className="text-xs font-extrabold text-white truncate">{currentUser.name}</p>
                  <p className="text-[11px] text-brand-400 font-semibold">{currentUser.role}</p>
                  <p className="text-[10px] text-slate-500 truncate">{currentUser.phone}</p>
                </div>

                <div className="px-2 pt-2">
                  <button
                    onClick={onLogout}
                    className="w-full text-left px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors flex items-center justify-between"
                  >
                    <span>Sign Out</span>
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Direct Logout Button */}
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 border border-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>

          </div>
        </div>
      </div>
    </header>
  );
};
