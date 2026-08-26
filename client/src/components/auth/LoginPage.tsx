import React, { useState } from 'react';
import { api } from '../../services/api.js';
import { User, LanguageCode } from '../../types/index.js';
import {
  Compass,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Shield,
  Car,
  UserCheck,
  Truck,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Mic,
  MapPin,
  HeartHandshake,
  KeyRound
} from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: User, token: string) => void;
  onNavigateRegister: () => void;
  language: LanguageCode;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onNavigateRegister,
  language
}) => {
  const [identifier, setIdentifier] = useState('mgdhanyamohan');
  const [password, setPassword] = useState('Thathu@110');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeRoleFilter, setActiveRoleFilter] = useState<'ADMIN' | 'PASSENGER' | 'DRIVER' | 'FLEET'>('ADMIN');

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!identifier.trim()) {
      setErrorMsg('Please enter your username, email, or mobile number');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await api.loginWithCredentials(identifier.trim(), password);
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSelectPersona = (roleKey: 'ADMIN' | 'PASSENGER' | 'DRIVER' | 'FLEET') => {
    setActiveRoleFilter(roleKey);
    setErrorMsg('');
    if (roleKey === 'ADMIN') {
      setIdentifier('mgdhanyamohan');
      setPassword('Thathu@110');
    } else if (roleKey === 'PASSENGER') {
      setIdentifier('dhanya');
      setPassword('Thathu@110');
    } else if (roleKey === 'DRIVER') {
      setIdentifier('rahul');
      setPassword('Thathu@110');
    } else if (roleKey === 'FLEET') {
      setIdentifier('keralacabs');
      setPassword('Thathu@110');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row relative selection:bg-brand-500 selection:text-white font-sans overflow-hidden">
      
      {/* Background Ambient Lights */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* ========================================================= */}
      {/* LEFT COLUMN: HERO & BRAND SHOWCASE (Visible on LG screens) */}
      {/* ========================================================= */}
      <div className="lg:w-1/2 p-8 lg:p-16 flex flex-col justify-between relative bg-gradient-to-b from-slate-900/90 via-slate-950/80 to-slate-950 border-b lg:border-b-0 lg:border-r border-slate-800/80">
        
        {/* Brand Header */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center text-white shadow-xl shadow-brand-500/25 ring-2 ring-brand-400/30">
              <Compass className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-black tracking-tight text-white">AditiRide</span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 uppercase tracking-wider">
                  Universal Mobility
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Smart Ride-Hailing, Multimodal Dispatch & Fleet Platform</p>
            </div>
          </div>
        </div>

        {/* Hero Value Props & Graphics */}
        <div className="my-10 space-y-6">
          <div className="space-y-3">
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Move effortlessly across city and state.
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed max-w-lg">
              Book rides in 3 clicks, schedule in Malayalam & English by voice, direct-request your favorite captains, and manage pricing transparency from one unified control plane.
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-4 bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-800 flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 shrink-0">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-white">Voice Booking in 6 Languages</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Malayalam, Hindi, Tamil, Kannada, Telugu & English NLP.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-800 flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-white">Favorite Captains</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Send direct requests to trusted drivers you love.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-800 flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
                <Car className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-white">Multi-Modal Fleet</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Autos, Bikes, Sedans, SUVs, XL, Rentals & Outstation.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-800 flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-white">24/7 Safety Shield</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">4-digit trip PINs, masked calling & instant SOS response.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Trust Bar */}
        <div className="pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <span>© 2026 AditiRide Platform</span>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-emerald-400 font-semibold">Live Operational Gateway</span>
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* RIGHT COLUMN: LOGIN FORM & ROLE SELECTOR                  */}
      {/* ========================================================= */}
      <div className="lg:w-1/2 p-6 sm:p-12 lg:p-16 flex items-center justify-center relative">
        <div className="w-full max-w-md space-y-6">
          
          {/* Card Wrapper with Frosted Glass */}
          <div className="bg-slate-900/90 backdrop-blur-xl p-7 sm:p-9 rounded-3xl border border-slate-800 shadow-2xl space-y-5">
            
            {/* Header */}
            <div className="space-y-1">
              <h2 className="text-2xl font-black tracking-tight text-white">Sign In</h2>
              <p className="text-xs text-slate-400">Select your role or enter your credentials to continue.</p>
            </div>

            {/* Persona Quick Filters */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Select Persona
              </label>
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleQuickSelectPersona('ADMIN')}
                  className={`py-2 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                    activeRoleFilter === 'ADMIN'
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickSelectPersona('PASSENGER')}
                  className={`py-2 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                    activeRoleFilter === 'PASSENGER'
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>Passenger</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickSelectPersona('DRIVER')}
                  className={`py-2 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                    activeRoleFilter === 'DRIVER'
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Captain</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickSelectPersona('FLEET')}
                  className={`py-2 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                    activeRoleFilter === 'FLEET'
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Fleet</span>
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="p-3 bg-rose-950/70 border border-rose-800 rounded-2xl text-xs font-semibold text-rose-300 animate-in fade-in flex items-center space-x-2">
                <span className="text-rose-400">⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              
              {/* Identifier Input */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Username / Email / Mobile Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="Enter username, email, or mobile"
                    className="block w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Password
                  </label>
                  <span className="text-[10px] text-slate-500">Default: Thathu@110</span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="block w-full pl-10 pr-10 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Action */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-emerald-500 hover:from-brand-500 hover:to-emerald-400 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-brand-500/25 transition-all flex items-center justify-center space-x-2 active:scale-98 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick-Fill Super Admin Banner */}
            <div className="p-3 bg-brand-950/40 border border-brand-800/40 rounded-2xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-brand-400 flex items-center space-x-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Admin Fast Login</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleQuickSelectPersona('ADMIN')}
                  className="text-[10px] font-bold text-white bg-brand-600 hover:bg-brand-700 px-2 py-0.5 rounded-lg shadow-sm"
                >
                  Auto-Fill
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                User: <span className="text-white font-mono font-bold">mgdhanyamohan</span> • Pass: <span className="text-white font-mono font-bold">Thathu@110</span>
              </p>
            </div>

            {/* Register Navigation */}
            <div className="text-center pt-1 border-t border-slate-800/80">
              <p className="text-xs text-slate-400">
                New to AditiRide?{' '}
                <button
                  type="button"
                  onClick={onNavigateRegister}
                  className="font-bold text-brand-400 hover:text-brand-300 underline"
                >
                  Create an account
                </button>
              </p>
            </div>

          </div>

        </div>
      </div>

    </div>
  );
};
