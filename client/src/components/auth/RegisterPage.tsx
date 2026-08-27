import React, { useState } from 'react';
import { api } from '../../services/api.js';
import { User, LanguageCode } from '../../types/index.js';
import {
  Compass,
  Car,
  UserCheck,
  Truck,
  ArrowRight,
  ShieldCheck,
  Lock,
  User as UserIcon,
  Phone,
  Mail,
  FileText,
  Sparkles,
  CheckCircle2,
  Mic,
  Shield,
  HeartHandshake
} from 'lucide-react';

interface RegisterPageProps {
  onRegisterSuccess: (user: User, token: string) => void;
  onNavigateLogin: () => void;
  language: LanguageCode;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  onRegisterSuccess,
  onNavigateLogin,
  language
}) => {
  const [role, setRole] = useState<'PASSENGER' | 'DRIVER' | 'FLEET_MANAGER'>('PASSENGER');

  // Common Fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  // Driver Fields
  const [vehicleCategoryId, setVehicleCategoryId] = useState('cat_auto');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  // Fleet Owner Fields
  const [companyName, setCompanyName] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setErrorMsg('Full name and mobile phone number are required.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Password is required and must be at least 6 characters.');
      return;
    }

    if (role === 'DRIVER') {
      if (!vehicleBrand.trim() || !vehicleModel.trim() || !vehiclePlate.trim() || !licenseNumber.trim()) {
        setErrorMsg('All vehicle and driving license details are required for driver registration.');
        return;
      }
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const payload: any = {
        name: name.trim(),
        username: username.trim() || undefined,
        phone: phone.trim(),
        email: email.trim() || undefined,
        password: password,
        role,
        preferredLanguage: 'en',
        emergencyContact
      };

      if (role === 'DRIVER') {
        payload.vehicleCategoryId = vehicleCategoryId;
        payload.vehicleBrand = vehicleBrand.trim();
        payload.vehicleModel = vehicleModel.trim();
        payload.vehiclePlate = vehiclePlate.trim();
        payload.licenseNumber = licenseNumber.trim();
      } else if (role === 'FLEET_MANAGER') {
        payload.companyName = companyName.trim();
      }

      const res = await api.registerUser(payload);
      onRegisterSuccess(res.user, res.token);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row relative selection:bg-brand-500 selection:text-white font-sans overflow-hidden">
      
      {/* Ambient Lights */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* ========================================================= */}
      {/* LEFT COLUMN: ONBOARDING INFO & BENEFITS                   */}
      {/* ========================================================= */}
      <div className="lg:w-1/2 p-8 lg:p-16 flex flex-col justify-between relative bg-gradient-to-b from-slate-900/90 via-slate-950/80 to-slate-950 border-b lg:border-b-0 lg:border-r border-slate-800/80">
        
        {/* Brand Header */}
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center text-white shadow-xl shadow-brand-500/25 ring-2 ring-brand-400/30">
            <Compass className="w-7 h-7 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-black tracking-tight text-white">AditiRide</span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 uppercase tracking-wider">
                Registration
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Join the next-generation mobility network</p>
          </div>
        </div>

        {/* Dynamic Benefits by Selected Role */}
        <div className="my-8 space-y-6">
          {role === 'PASSENGER' && (
            <div className="space-y-4 animate-in fade-in">
              <span className="text-xs font-bold px-3 py-1 bg-brand-500/10 text-brand-400 rounded-full border border-brand-500/20">
                🚗 Passenger Experience
              </span>
              <h2 className="text-3xl font-extrabold text-white">Fast, transparent & voice-enabled rides.</h2>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>₹500 instant welcome wallet credit upon registration.</span>
                </li>
                <li className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Speak in Malayalam or English to book rides in seconds.</span>
                </li>
                <li className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Choose your favorite captain with direct routing.</span>
                </li>
              </ul>
            </div>
          )}

          {role === 'DRIVER' && (
            <div className="space-y-4 animate-in fade-in">
              <span className="text-xs font-bold px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                🚖 Captain Partner Program
              </span>
              <h2 className="text-3xl font-extrabold text-white">Earn on your terms with custom pricing.</h2>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Set your own per-km rates within fair platform bounds.</span>
                </li>
                <li className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Lowest platform commission in Kerala (10–12%).</span>
                </li>
                <li className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Direct bookings from repeat passengers who favorite you.</span>
                </li>
              </ul>
            </div>
          )}

          {role === 'FLEET_MANAGER' && (
            <div className="space-y-4 animate-in fade-in">
              <span className="text-xs font-bold px-3 py-1 bg-purple-500/10 text-purple-400 rounded-full border border-purple-500/20">
                🏢 Fleet Operator Solution
              </span>
              <h2 className="text-3xl font-extrabold text-white">Scale and monitor your multi-vehicle fleet.</h2>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Real-time telematics dispatch & driver shift scheduling.</span>
                </li>
                <li className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Consolidated revenue analytics and payout settlement.</span>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-slate-800/80 text-xs text-slate-500">
          Already have an account?{' '}
          <button onClick={onNavigateLogin} className="text-brand-400 font-bold hover:underline">
            Sign In here →
          </button>
        </div>

      </div>

      {/* ========================================================= */}
      {/* RIGHT COLUMN: REGISTRATION FORM                           */}
      {/* ========================================================= */}
      <div className="lg:w-1/2 p-6 sm:p-12 lg:p-16 flex items-center justify-center relative overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          
          <div className="bg-slate-900/90 backdrop-blur-xl p-7 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-5">
            
            <div>
              <h2 className="text-2xl font-black text-white">Create Account</h2>
              <p className="text-xs text-slate-400 mt-0.5">Select role and fill in your profile details.</p>
            </div>

            {/* Role Switcher */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                Account Type
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setRole('PASSENGER')}
                  className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                    role === 'PASSENGER' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Car className="w-4 h-4" />
                  <span>Passenger</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('DRIVER')}
                  className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                    role === 'DRIVER' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Captain</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('FLEET_MANAGER')}
                  className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center space-y-1 transition-all ${
                    role === 'FLEET_MANAGER' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  <span>Fleet</span>
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-950/70 border border-rose-800 rounded-2xl text-xs font-semibold text-rose-300 animate-in fade-in">
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-3.5">
              
              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Full Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Anand Varma"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Mobile Number *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+91 9447123456"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
              </div>

              {/* Username & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="e.g. anand_v"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Password *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Choose password"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                    required
                  />
                </div>
              </div>

              {/* Driver Fields */}
              {role === 'DRIVER' && (
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-brand-800/40 space-y-2.5">
                  <span className="text-[11px] font-extrabold text-brand-400 flex items-center space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Captain & Vehicle Parameters</span>
                  </span>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Vehicle Category</label>
                    <select
                      value={vehicleCategoryId}
                      onChange={e => setVehicleCategoryId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                    >
                      <option value="cat_auto">Aditi Auto (Auto Rickshaw - 3 Seater)</option>
                      <option value="cat_bike">Aditi Bike (Bike Taxi - 1 Seater)</option>
                      <option value="cat_economy">Aditi Mini (Hatchback / EV - 4 Seater)</option>
                      <option value="cat_sedan">Aditi Prime Sedan (Comfort - 4 Seater)</option>
                      <option value="cat_suv">Aditi XL (SUV - 6 Seater)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Plate #</label>
                      <input
                        type="text"
                        value={vehiclePlate}
                        onChange={e => setVehiclePlate(e.target.value)}
                        placeholder="KL-08-BW-7777"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white uppercase font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">License #</label>
                      <input
                        type="text"
                        value={licenseNumber}
                        onChange={e => setLicenseNumber(e.target.value)}
                        placeholder="DL-08-2024"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white uppercase font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Fleet Field */}
              {role === 'FLEET_MANAGER' && (
                <div className="space-y-1 p-3 bg-slate-950 rounded-2xl border border-brand-800/40">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">Fleet / Organization Name *</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="e.g. Kerala Star Mobility"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 bg-gradient-to-r from-brand-600 to-emerald-500 hover:from-brand-500 hover:to-emerald-400 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-brand-500/25 transition-all flex items-center justify-center space-x-2 active:scale-98 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <span>Register as {role === 'PASSENGER' ? 'Passenger' : role === 'DRIVER' ? 'Captain' : 'Fleet Partner'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center pt-1 border-t border-slate-800/80">
              <p className="text-xs text-slate-400">
                Already registered?{' '}
                <button onClick={onNavigateLogin} className="font-bold text-brand-400 hover:underline">
                  Sign In
                </button>
              </p>
            </div>

          </div>

        </div>
      </div>

    </div>
  );
};
