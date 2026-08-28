import React, { useState } from 'react';
import { api } from '../../services/api.js';
import { User, LanguageCode } from '../../types/index.js';
import { GoogleAuthButton } from './GoogleAuthButton.js';
import {
  Compass,
  Lock,
  Mail,
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
  HeartHandshake
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
  const [emailOrIdentifier, setEmailOrIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [activeRoleFilter, setActiveRoleFilter] = useState<'ADMIN' | 'PASSENGER' | 'DRIVER' | 'FLEET'>('PASSENGER');

  const handleEmailPasswordLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!emailOrIdentifier.trim()) {
      setErrorMsg('Please enter your email address');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await api.loginWithCredentials(emailOrIdentifier.trim(), password);
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (googleData: {
    credential?: string;
    email?: string;
    name?: string;
    googleId?: string;
    avatarUrl?: string;
  }) => {
    setIsGoogleLoading(true);
    setErrorMsg('');

    try {
      const res = await api.loginWithGoogle({
        ...googleData,
        role: activeRoleFilter === 'FLEET' ? 'FLEET_MANAGER' : activeRoleFilter,
        preferredLanguage: language
      });
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setErrorMsg(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setIsGoogleLoading(false);
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
              <p className="text-xs text-slate-400 font-medium">Authoritative Multi-Modal Mobility Platform</p>
            </div>
          </div>

          <div className="pt-8 space-y-3">
            <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Seamless travel & logistics, <br />
              <span className="bg-gradient-to-r from-brand-400 via-emerald-300 to-teal-200 bg-clip-text text-transparent">
                built for Kerala & Beyond.
              </span>
            </h1>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              Experience prompt rides, heavy logistics, curated Kerala tours, favorite-driver direct dispatches, and multilingual voice booking.
            </p>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 gap-3.5 my-8">
          <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-1">
            <div className="flex items-center space-x-2 text-brand-400">
              <Mic className="w-4 h-4" />
              <span className="text-xs font-bold text-slate-200">Voice Booking</span>
            </div>
            <p className="text-[11px] text-slate-400">Malayalam, Hindi, Tamil & English natural speech booking</p>
          </div>

          <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-1">
            <div className="flex items-center space-x-2 text-emerald-400">
              <HeartHandshake className="w-4 h-4" />
              <span className="text-xs font-bold text-slate-200">Favorite Drivers</span>
            </div>
            <p className="text-[11px] text-slate-400">Direct dispatch to your trusted, preferred captains</p>
          </div>

          <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-1">
            <div className="flex items-center space-x-2 text-amber-400">
              <Truck className="w-4 h-4" />
              <span className="text-xs font-bold text-slate-200">Logistics & Tours</span>
            </div>
            <p className="text-[11px] text-slate-400">Goods lorries, container trucks & tourist coaches</p>
          </div>

          <div className="p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-1">
            <div className="flex items-center space-x-2 text-sky-400">
              <Shield className="w-4 h-4" />
              <span className="text-xs font-bold text-slate-200">Zero-Trust Safety</span>
            </div>
            <p className="text-[11px] text-slate-400">4-digit PIN verify, 2-way block, SOS & live share</p>
          </div>
        </div>

        {/* Footer Meta */}
        <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <span>© 2026 AditiRide Systems Inc.</span>
          <span className="flex items-center space-x-1 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Production-Grade Architecture</span>
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* RIGHT COLUMN: PROFESSIONAL LOGIN INTERFACE */}
      {/* ========================================================= */}
      <div className="lg:w-1/2 p-6 lg:p-16 flex items-center justify-center relative overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          
          {/* Card Container */}
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 lg:p-8 shadow-2xl shadow-black/60 space-y-6">
            
            {/* Header */}
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">Sign In</h2>
              <p className="text-xs text-slate-400 mt-1">
                Authenticate with Google or enter your email and password.
              </p>
            </div>

            {/* Portal Persona Focus Bar */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Select Your Portal
              </label>
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveRoleFilter('PASSENGER')}
                  className={`py-2 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                    activeRoleFilter === 'PASSENGER'
                      ? 'bg-brand-600 text-white shadow-md ring-1 ring-brand-400/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>Passenger</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveRoleFilter('DRIVER')}
                  className={`py-2 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                    activeRoleFilter === 'DRIVER'
                      ? 'bg-brand-600 text-white shadow-md ring-1 ring-brand-400/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Captain</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveRoleFilter('FLEET')}
                  className={`py-2 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                    activeRoleFilter === 'FLEET'
                      ? 'bg-brand-600 text-white shadow-md ring-1 ring-brand-400/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Fleet</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveRoleFilter('ADMIN')}
                  className={`py-2 rounded-xl text-[11px] font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                    activeRoleFilter === 'ADMIN'
                      ? 'bg-brand-600 text-white shadow-md ring-1 ring-brand-400/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin</span>
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

            {/* PRIMARY AUTH OPTION 1: GOOGLE AUTHENTICATION */}
            <div className="space-y-2">
              <GoogleAuthButton
                text="continue"
                isLoading={isGoogleLoading}
                disabled={isLoading}
                onSuccess={handleGoogleSuccess}
                onError={setErrorMsg}
              />
            </div>

            {/* STYLISH DIVIDER */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-3 text-[10px] uppercase font-bold tracking-widest text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                Or continue with email
              </span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            {/* PRIMARY AUTH OPTION 2: EMAIL & PASSWORD FORM */}
            <form onSubmit={handleEmailPasswordLogin} className="space-y-4">
              
              {/* Email Input */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Email Address / Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={emailOrIdentifier}
                    onChange={e => setEmailOrIdentifier(e.target.value)}
                    placeholder="name@example.com"
                    className="block w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
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
                disabled={isLoading || isGoogleLoading}
                className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-emerald-500 hover:from-brand-500 hover:to-emerald-400 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-brand-500/25 transition-all flex items-center justify-center space-x-2 active:scale-98 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Register Navigation */}
            <div className="text-center pt-2 border-t border-slate-800/80">
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
