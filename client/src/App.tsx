import React, { useState, useEffect } from 'react';
import { User, LanguageCode } from './types/index.js';
import { api } from './services/api.js';
import { Navbar } from './components/common/Navbar.js';
import { LoginPage } from './components/auth/LoginPage.js';
import { RegisterPage } from './components/auth/RegisterPage.js';
import { PassengerHome } from './components/passenger/PassengerHome.js';
import { LiveTrackingView } from './components/passenger/LiveTrackingView.js';
import { WalletView } from './components/passenger/WalletView.js';
import { ScheduledRidesView } from './components/passenger/ScheduledRidesView.js';
import { FavoritesAndBlocks } from './components/passenger/FavoritesAndBlocks.js';
import { TripHistoryView } from './components/passenger/TripHistoryView.js';
import { DriverHome } from './components/driver/DriverHome.js';
import { FleetPortal } from './components/fleet/FleetPortal.js';
import { AdminDashboard } from './components/admin/AdminDashboard.js';
import {
  Car,
  Clock,
  Heart,
  Wallet,
  History
} from 'lucide-react';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem('aditiride_token');
  });

  const [authScreen, setAuthScreen] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('aditiride_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return null;
  });

  const [passengerTab, setPassengerTab] = useState<'BOOK' | 'SCHEDULED' | 'FAVORITES' | 'WALLET' | 'HISTORY'>('BOOK');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(1250);

  useEffect(() => {
    if (currentUser) {
      checkForActiveTrip(currentUser);
      setLanguage(currentUser.preferred_language || 'en');
    }
  }, []);

  const checkForActiveTrip = async (user: User) => {
    try {
      const res = await api.getActiveBooking(user.id, user.role);
      if (res.activeBooking) {
        setActiveBookingId(res.activeBooking.id);
      } else {
        setActiveBookingId(null);
      }
    } catch (err) {
      console.error('Active trip check error:', err);
    }
  };

  const handleLoginSuccess = (user: User, token: string) => {
    localStorage.setItem('aditiride_token', token);
    localStorage.setItem('aditiride_user', JSON.stringify(user));
    setCurrentUser(user);
    setIsAuthenticated(true);
    setLanguage(user.preferred_language || 'en');
    checkForActiveTrip(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('aditiride_token');
    localStorage.removeItem('aditiride_user');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setAuthScreen('LOGIN');
    setActiveBookingId(null);
  };

  // If unauthenticated, render Login or Register Page
  if (!isAuthenticated || !currentUser) {
    if (authScreen === 'REGISTER') {
      return (
        <RegisterPage
          onRegisterSuccess={handleLoginSuccess}
          onNavigateLogin={() => setAuthScreen('LOGIN')}
          language={language}
        />
      );
    }
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onNavigateRegister={() => setAuthScreen('REGISTER')}
        language={language}
      />
    );
  }

  // Determine portal strictly by logged-in user role
  const isSuperAdminOrAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN';
  const isDriver = currentUser.role === 'DRIVER';
  const isFleetManager = currentUser.role === 'FLEET_MANAGER';
  const isPassenger = currentUser.role === 'PASSENGER';

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-brand-500 selection:text-white font-sans">
      
      {/* Strict Role-Based Navbar */}
      <Navbar
        currentUser={currentUser}
        language={language}
        onSelectLanguage={setLanguage}
        walletBalance={walletBalance}
        hasActiveTrip={!!activeBookingId}
        onNavigateActiveTrip={() => {
          setPassengerTab('BOOK');
        }}
        onLogout={handleLogout}
      />

      {/* Main Body - Strictly Isolated by Role */}
      <main className="flex-1 pb-16">
        
        {/* 1. ADMIN & SUPER ADMIN ONLY PORTAL */}
        {isSuperAdminOrAdmin && (
          <div className="pt-4">
            <AdminDashboard currentUser={currentUser} language={language} />
          </div>
        )}

        {/* 2. DRIVER / CAPTAIN ONLY PORTAL */}
        {isDriver && (
          <div className="pt-4">
            <DriverHome currentUser={currentUser} language={language} />
          </div>
        )}

        {/* 3. FLEET OWNER ONLY PORTAL */}
        {isFleetManager && (
          <div className="pt-4">
            <FleetPortal currentUser={currentUser} language={language} />
          </div>
        )}

        {/* 4. PASSENGER ONLY PORTAL */}
        {isPassenger && (
          <div>
            {/* Passenger Sub-Navigation Tabs */}
            <div className="max-w-7xl mx-auto px-4 pt-4 sm:px-6 lg:px-8">
              <div className="flex items-center space-x-1 p-1 bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-x-auto text-xs font-bold w-fit">
                <button
                  onClick={() => setPassengerTab('BOOK')}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl transition-all ${
                    passengerTab === 'BOOK'
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>Book Ride</span>
                </button>

                <button
                  onClick={() => setPassengerTab('SCHEDULED')}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl transition-all ${
                    passengerTab === 'SCHEDULED'
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Scheduled</span>
                </button>

                <button
                  onClick={() => setPassengerTab('FAVORITES')}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl transition-all ${
                    passengerTab === 'FAVORITES'
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5" />
                  <span>Favorites & Blocks</span>
                </button>

                <button
                  onClick={() => setPassengerTab('WALLET')}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl transition-all ${
                    passengerTab === 'WALLET'
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Wallet</span>
                </button>

                <button
                  onClick={() => setPassengerTab('HISTORY')}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl transition-all ${
                    passengerTab === 'HISTORY'
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>History</span>
                </button>
              </div>
            </div>

            {/* Passenger View Routing */}
            {activeBookingId ? (
              <LiveTrackingView
                bookingId={activeBookingId}
                currentUser={currentUser}
                language={language}
                onTripFinished={() => setActiveBookingId(null)}
              />
            ) : passengerTab === 'BOOK' ? (
              <PassengerHome
                currentUser={currentUser}
                language={language}
                onBookingCreated={id => setActiveBookingId(id)}
              />
            ) : passengerTab === 'SCHEDULED' ? (
              <ScheduledRidesView
                currentUser={currentUser}
                language={language}
                onBookingDispatched={id => setActiveBookingId(id)}
              />
            ) : passengerTab === 'FAVORITES' ? (
              <FavoritesAndBlocks currentUser={currentUser} language={language} />
            ) : passengerTab === 'WALLET' ? (
              <WalletView
                currentUser={currentUser}
                language={language}
                onBalanceUpdated={b => setWalletBalance(b)}
              />
            ) : (
              <TripHistoryView
                currentUser={currentUser}
                language={language}
                onRebook={trip => {
                  setPassengerTab('BOOK');
                }}
              />
            )}
          </div>
        )}

      </main>

      {/* Clean Global Footer */}
      <footer className="py-4 border-t border-slate-800 text-center text-xs text-slate-500">
        <p>AditiRide Universal Mobility Platform • Strict Role-Isolated Workspaces</p>
      </footer>
    </div>
  );
};
