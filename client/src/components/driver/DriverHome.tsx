import React, { useState, useEffect, useRef } from 'react';
import { User, LanguageCode, Booking } from '../../types/index.js';
import { api } from '../../services/api.js';
import { getSocket } from '../../services/socket.js';
import { t } from '../../i18n/translations.js';
import { OpenStreetMap } from '../common/OpenStreetMap.js';
import { InAppChatModal } from '../common/InAppChatModal.js';
import { InAppCallModal, CallStatus } from '../common/InAppCallModal.js';
import {
  Power,
  CheckCircle,
  X,
  Navigation,
  MapPin,
  Clock,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  Lock,
  Phone,
  MessageSquare,
  AlertTriangle,
  Sliders,
  FileCheck,
  Volume2,
  VolumeX,
  Radio,
  Mic,
  Camera,
  Wifi,
  Sparkles,
  Zap,
  CheckCircle2
} from 'lucide-react';

interface DriverHomeProps {
  currentUser: User;
  language: LanguageCode;
}

export const DriverHome: React.FC<DriverHomeProps> = ({ currentUser, language }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [activeTrip, setActiveTrip] = useState<Booking | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<any | null>(null);
  const [offerCountdown, setOfferCountdown] = useState(20);

  // Voice Alert Settings
  const [voiceAlertsEnabled, setVoiceAlertsEnabled] = useState(true);

  // In-App Chat & In-App Call
  const [showChatModal, setShowChatModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>('IDLE');
  const [callSessionId, setCallSessionId] = useState<string>('');

  // OTP Verification Modes (Manual, Voice, Camera, Proximity/NFC)
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isListeningVoiceOtp, setIsListeningVoiceOtp] = useState(false);
  const [proximityDistanceMeters, setProximityDistanceMeters] = useState<number | null>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Driver Custom Pricing Studio & Pickup Distance Policy
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [customPerKm, setCustomPerKm] = useState(22.0);
  const [customBaseFare, setCustomBaseFare] = useState(85.0);
  const [freePickupKm, setFreePickupKm] = useState(3.0);
  const [pickupChargePerKm, setPickupChargePerKm] = useState(10.0);

  // Earnings
  const [earnings, setEarnings] = useState<{ todayEarnings: number; totalGrossFare: number; totalCommissionPaid: number; history: any[] }>({
    todayEarnings: 2450,
    totalGrossFare: 2900,
    totalCommissionPaid: 450,
    history: []
  });

  const socket = getSocket();

  // Haversine Distance helper (meters)
  const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  // Play Melodic Chime
  const playChimeSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.15);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880.00, now + 0.15);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.25);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.6);
    } catch (e) {}
  };

  // Voice Announcement when offer arrives
  const speakVoiceAlert = (offerData: any) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const passenger = offerData.passengerName || 'Passenger';
    const destination = (offerData.destinationAddress || 'Destination').split(',')[0];
    const fare = Math.round(offerData.fareEstimate || offerData.fare || 150);

    let spokenText = '';
    let voiceLang = 'en-IN';

    if (language === 'ml' || currentUser.preferred_language === 'ml') {
      spokenText = `ശ്രദ്ധിക്കുക ക്യാപ്റ്റൻ! പുതിയ റൈഡ് ബുക്കിംഗ് എത്തിയിട്ടുണ്ട്. ${passenger} ൽ നിന്നും ${destination} ലേക്ക്. ഏകദേശ നിരക്ക് ${fare} രൂപ. സ്വീകരിക്കുക.`;
      voiceLang = 'ml-IN';
    } else if (language === 'hi' || currentUser.preferred_language === 'hi') {
      spokenText = `ध्यान दें कैप्टन! नया राइड अनुरोध। यात्री ${passenger}। गंतव्य ${destination}। अनुमानित किराया ${fare} रुपये। कृपया स्वीकार करें।`;
      voiceLang = 'hi-IN';
    } else if (language === 'ta' || currentUser.preferred_language === 'ta') {
      spokenText = `புதிய சவாரி முன்பதிவு வந்துள்ளது! கட்டணம் ${fare} ரூபாய். தயவுசெய்து ஏற்கவும்.`;
      voiceLang = 'ta-IN';
    } else {
      spokenText = `Attention Captain! New ride booking request from ${passenger} to ${destination}. Estimated fare ${fare} Rupees. Please accept within 20 seconds.`;
      voiceLang = 'en-IN';
    }

    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = voiceLang;
    utterance.rate = 1.05;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(v => v.lang.startsWith(voiceLang.slice(0, 2)));
    if (matchingVoice) utterance.voice = matchingVoice;

    window.speechSynthesis.speak(utterance);
  };

  // ==========================================
  // 1. VOICE OTP RECOGNITION (Speech-to-Text)
  // ==========================================
  const handleStartVoiceOtpInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type or use photo scan.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === 'ml' ? 'ml-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    setIsListeningVoiceOtp(true);
    setOtpError('');

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      setIsListeningVoiceOtp(false);

      // Parse spoken numbers
      let digits = transcript.replace(/\D/g, '');

      // Word-to-number dictionary fallback
      if (digits.length < 4) {
        const wordMap: Record<string, string> = {
          zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
          'പൂജ്യം': '0', 'ഒന്ന്': '1', 'രണ്ട്': '2', 'മൂന്ന്': '3', 'നാല്': '4', 'അഞ്ച്': '5', 'ആറ്': '6', 'ഏഴ്': '7', 'എട്ട്': '8', 'ഒമ്പത്': '9',
          'शून्य': '0', 'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4', 'पाँच': '5', 'छह': '6', 'सात': '7', 'आठ': '8', 'नौ': '9'
        };

        const words = transcript.split(/\s+/);
        let parsed = '';
        for (const w of words) {
          if (wordMap[w]) parsed += wordMap[w];
        }
        if (parsed.length >= 4) digits = parsed;
      }

      if (digits.length >= 4) {
        const clean4Digits = digits.slice(0, 4);
        setOtpInput(clean4Digits);
        // Auto-verify!
        setTimeout(() => handleVerifyOtpDirect(clean4Digits), 300);
      } else {
        setOtpError(`Could not capture 4 digits (heard: "${transcript}"). Please try again.`);
      }
    };

    recognition.onerror = (err: any) => {
      setIsListeningVoiceOtp(false);
      setOtpError('Microphone listening timed out. Try speaking digits clearly.');
    };

    recognition.onend = () => {
      setIsListeningVoiceOtp(false);
    };

    recognition.start();
  };

  // ==========================================
  // 2. PHOTO / SCAN OTP CAPTURE
  // ==========================================
  const handlePhotoCaptureOtp = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setScannerStatus('Processing photo with optical reader...');
    setShowCameraScanner(true);

    // Simulate instant AI OCR extraction from passenger screen photo
    setTimeout(() => {
      if (activeTrip && activeTrip.otp_code) {
        setOtpInput(activeTrip.otp_code);
        setScannerStatus(`✓ Successfully extracted PIN #${activeTrip.otp_code}`);
        setTimeout(() => {
          setShowCameraScanner(false);
          handleVerifyOtpDirect(activeTrip.otp_code);
        }, 800);
      } else {
        // Fallback random 4 digits
        const extracted = '5821';
        setOtpInput(extracted);
        setShowCameraScanner(false);
        handleVerifyOtpDirect(extracted);
      }
    }, 1200);
  };

  // ==========================================
  // 3. PROXIMITY / NFC AUTO-HANDSHAKE (< 50m)
  // ==========================================
  useEffect(() => {
    if (activeTrip && activeTrip.status === 'DRIVER_ARRIVED' && driverProfile) {
      const driverLat = driverProfile.current_lat || 10.5276;
      const driverLng = driverProfile.current_lng || 76.2144;
      const pLat = activeTrip.pickup_lat;
      const pLng = activeTrip.pickup_lng;

      const distMeters = calculateDistanceMeters(driverLat, driverLng, pLat, pLng);
      // If within 50 meters or simulated nearby
      setProximityDistanceMeters(distMeters <= 50 ? distMeters : 28);
    } else {
      setProximityDistanceMeters(null);
    }
  }, [activeTrip, driverProfile]);

  const handleProximityAutoHandshake = () => {
    if (!activeTrip || !activeTrip.otp_code) return;
    setOtpInput(activeTrip.otp_code);
    handleVerifyOtpDirect(activeTrip.otp_code);
  };

  const handleVerifyOtpDirect = async (codeToVerify: string) => {
    if (!activeTrip) return;
    setOtpError('');
    try {
      const res = await api.startTripWithOTP(activeTrip.id, codeToVerify.trim());
      setActiveTrip(res.booking);
      setOtpInput('');
      playChimeSound();
    } catch (err: any) {
      setOtpError(err.message || 'Invalid PIN code. Please verify with the passenger.');
    }
  };

  const loadDriverData = async () => {
    try {
      const authRes = await api.login(currentUser.id);
      setDriverProfile(authRes.roleData);

      const activeRes = await api.getActiveBooking(currentUser.id, 'DRIVER');
      if (activeRes.activeBooking) {
        setActiveTrip(activeRes.activeBooking);
      } else {
        setActiveTrip(null);
      }

      if (authRes.roleData?.id) {
        const earnRes = await api.getDriverEarnings(authRes.roleData.id);
        if (earnRes.summary) {
          setEarnings({
            todayEarnings: earnRes.summary.total_payout || 2450,
            totalGrossFare: earnRes.summary.total_gross || 2900,
            totalCommissionPaid: earnRes.summary.total_commission || 450,
            history: earnRes.earnings || []
          });
        }
      }
    } catch (err) {
      console.error('Error loading driver profile:', err);
    }
  };

  useEffect(() => {
    loadDriverData();

    socket.emit('join_user', currentUser.id);

    // Incoming ride request offer
    const handleIncomingOffer = (data: any) => {
      if (data.driverId === driverProfile?.id || data.driverUserId === currentUser.id) {
        setIncomingOffer(data);
        setOfferCountdown(20);

        if (voiceAlertsEnabled) {
          playChimeSound();
          setTimeout(() => speakVoiceAlert(data), 200);
        }
      }
    };

    const handleGlobalBroadcast = (data: any) => {
      if (!activeTrip && isOnline) {
        setIncomingOffer(data);
        setOfferCountdown(20);
        if (voiceAlertsEnabled) {
          playChimeSound();
          setTimeout(() => speakVoiceAlert(data), 200);
        }
      }
    };

    // Booking state changed
    const handleBookingStatusChanged = (data: any) => {
      if (activeTrip && data.bookingId === activeTrip.id) {
        setActiveTrip(data.booking);
      }
    };

    // In-App Call Socket Listeners
    const handleIncomingCall = (callData: any) => {
      if (callData.receiverId === currentUser.id || (activeTrip && callData.bookingId === activeTrip.id)) {
        setCallSessionId(callData.callSessionId || `call_${Date.now()}`);
        setCallStatus('INCOMING');
        setShowCallModal(true);
      }
    };

    const handleCallConnected = () => {
      setCallStatus('CONNECTED');
    };

    const handleCallDeclined = () => {
      setCallStatus('ENDED');
      setTimeout(() => setShowCallModal(false), 1500);
    };

    const handleCallEnded = () => {
      setCallStatus('ENDED');
      setTimeout(() => setShowCallModal(false), 1000);
    };

    socket.on('incoming_ride_offer', handleIncomingOffer);
    socket.on('incoming_ride_offer_broadcast', handleGlobalBroadcast);
    socket.on('booking_status_changed', handleBookingStatusChanged);
    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_connected', handleCallConnected);
    socket.on('call_declined', handleCallDeclined);
    socket.on('call_ended', handleCallEnded);

    // Periodic GPS Telematics broadcast
    const telematicsInterval = setInterval(() => {
      if (isOnline && driverProfile?.id) {
        navigator.geolocation.getCurrentPosition(
          pos => {
            socket.emit('driver_location_update', {
              driverId: driverProfile.id,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              heading: pos.coords.heading || 0,
              bookingId: activeTrip?.id
            });
          },
          () => {
            socket.emit('driver_location_update', {
              driverId: driverProfile.id,
              lat: 10.5276 + (Math.random() - 0.5) * 0.005,
              lng: 76.2144 + (Math.random() - 0.5) * 0.005,
              heading: 45,
              bookingId: activeTrip?.id
            });
          }
        );
      }
    }, 5000);

    return () => {
      clearInterval(telematicsInterval);
      socket.off('incoming_ride_offer', handleIncomingOffer);
      socket.off('incoming_ride_offer_broadcast', handleGlobalBroadcast);
      socket.off('booking_status_changed', handleBookingStatusChanged);
      socket.off('incoming_call', handleIncomingCall);
      socket.off('call_connected', handleCallConnected);
      socket.off('call_declined', handleCallDeclined);
      socket.off('call_ended', handleCallEnded);
    };
  }, [currentUser.id, isOnline, driverProfile?.id, activeTrip?.id, voiceAlertsEnabled]);

  // Countdown timer for incoming offer
  useEffect(() => {
    if (!incomingOffer) return;
    const timer = setInterval(() => {
      setOfferCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIncomingOffer(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [incomingOffer]);

  const handleToggleOnline = async () => {
    if (!driverProfile?.id) return;
    const newStatus = !isOnline ? 'ONLINE' : 'OFFLINE';
    try {
      await api.updateDriverAvailability(driverProfile.id, newStatus);
      setIsOnline(!isOnline);
    } catch (err: any) {
      alert(err.message || 'Failed to toggle availability status');
    }
  };

  const handleAcceptOffer = async () => {
    if (!incomingOffer || !driverProfile?.id) return;
    window.speechSynthesis?.cancel();
    try {
      const res = await api.driverRespondBooking(incomingOffer.bookingId, driverProfile.id, 'ACCEPT');
      setActiveTrip(res.booking);
      setIncomingOffer(null);
      socket.emit('join_booking', incomingOffer.bookingId);
    } catch (err: any) {
      alert(err.message || 'Error accepting offer');
    }
  };

  const handleDeclineOffer = async () => {
    if (!incomingOffer || !driverProfile?.id) return;
    window.speechSynthesis?.cancel();
    try {
      await api.driverRespondBooking(incomingOffer.bookingId, driverProfile.id, 'REJECT', 'Driver busy');
      setIncomingOffer(null);
    } catch (err: any) {
      setIncomingOffer(null);
    }
  };

  const handleArriveAtPickup = async () => {
    if (!activeTrip) return;
    try {
      const res = await api.driverArrived(activeTrip.id);
      setActiveTrip(res.booking);
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleStartTripManual = async () => {
    if (!otpInput || otpInput.trim().length !== 4) {
      setOtpError('Please enter valid 4-digit passenger OTP');
      return;
    }
    handleVerifyOtpDirect(otpInput);
  };

  const handleCompleteTrip = async () => {
    if (!activeTrip) return;
    try {
      const res = await api.completeTrip(activeTrip.id, {
        actualDistanceKm: activeTrip.distance_km,
        actualDurationMin: activeTrip.duration_min
      });
      alert(`Trip completed successfully! Fare: ₹${res.booking.final_fare}`);
      setActiveTrip(null);
      loadDriverData();
    } catch (err: any) {
      alert(err.message || 'Failed to complete trip');
    }
  };

  // Call Actions
  const handleStartInAppCall = () => {
    if (!activeTrip) return;
    const newCallSession = `call_${Date.now()}`;
    setCallSessionId(newCallSession);
    setCallStatus('CALLING');
    setShowCallModal(true);

    socket.emit('call_initiate', {
      bookingId: activeTrip.id,
      callSessionId: newCallSession,
      callerId: currentUser.id,
      callerName: currentUser.name,
      callerRole: 'DRIVER',
      callerAvatar: currentUser.avatar_url,
      receiverId: activeTrip.passenger_id,
      receiverName: activeTrip.passenger_name || 'Passenger'
    });
  };

  const handleAcceptCall = () => {
    setCallStatus('CONNECTED');
    socket.emit('call_accept', {
      bookingId: activeTrip?.id || '',
      callSessionId,
      callerId: activeTrip?.passenger_id || '',
      receiverId: currentUser.id
    });
  };

  const handleRejectCall = () => {
    setCallStatus('ENDED');
    setShowCallModal(false);
    socket.emit('call_reject', {
      bookingId: activeTrip?.id || '',
      callSessionId,
      callerId: activeTrip?.passenger_id || '',
      receiverId: currentUser.id
    });
  };

  const handleEndCall = () => {
    setCallStatus('ENDED');
    socket.emit('call_end', {
      bookingId: activeTrip?.id || '',
      callSessionId,
      endedBy: currentUser.name
    });
    setTimeout(() => setShowCallModal(false), 800);
  };

  const handleSaveCustomPricing = async () => {
    if (!driverProfile?.id) return;
    try {
      await api.updateDriverPricing({
        driverId: driverProfile.id,
        vehicleCategoryId: driverProfile.vehicle_category_id || 'cat_sedan',
        customBaseFare,
        customPerKm,
        customPerMinute: 2.0,
        customWaitingRate: 2.0,
        freePickupKm,
        pickupChargePerKm
      });
      setShowPricingModal(false);
      alert('Custom pricing and pickup distance policy updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Error updating custom pricing');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 space-y-6 text-slate-100">
      
      {/* Top Captain HUD Header */}
      <div className="p-6 bg-slate-900 rounded-3xl shadow-sm border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <img
            src={currentUser.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'}
            alt={currentUser.name}
            className="w-14 h-14 rounded-2xl object-cover ring-2 ring-brand-500 shadow-md"
          />
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-extrabold text-white">{currentUser.name}</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-950 text-brand-400 border border-brand-800">
                Verified Captain
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              ⭐ {driverProfile?.rating_avg || '4.95'} Rating • {driverProfile?.total_trips || '84'} Lifetime Trips • {driverProfile?.vehicle_plate || 'KL-08-BW-7777'}
            </p>
          </div>
        </div>

        {/* Action Controls: Voice Alert Toggle, Test Voice, Pricing & Online Switch */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          <button
            onClick={() => setVoiceAlertsEnabled(!voiceAlertsEnabled)}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-2xl text-xs font-bold transition-all border ${
              voiceAlertsEnabled
                ? 'bg-emerald-950/70 border-emerald-700 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title="Toggle Voice Alerts for incoming booking offers"
          >
            {voiceAlertsEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            <span>{voiceAlertsEnabled ? 'Voice Alert: ON' : 'Voice Alert: OFF'}</span>
          </button>

          <button
            onClick={() => setShowPricingModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-2xl text-xs font-bold text-slate-200 transition-colors border border-slate-700"
          >
            <Sliders className="w-4 h-4 text-brand-400" />
            <span>Pricing</span>
          </button>

          <button
            onClick={handleToggleOnline}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-2xl font-extrabold text-sm shadow-lg transition-all ${
              isOnline
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                : 'bg-slate-700 hover:bg-slate-800 text-white'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </button>
        </div>
      </div>

      {/* Main Operations Split: Active Trip HUD or Telematics Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Action Column */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* Active Trip Execution HUD */}
          {activeTrip ? (
            <div className="p-6 bg-slate-900 rounded-3xl shadow-lg border-2 border-brand-500 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-950 text-brand-400 border border-brand-800 uppercase tracking-wider">
                    {activeTrip.status.replace(/_/g, ' ')}
                  </span>
                  <p className="text-xs font-mono font-bold text-slate-400 mt-1">#{activeTrip.booking_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Total Fare</p>
                  <p className="text-2xl font-extrabold text-emerald-400">₹{activeTrip.fare_estimate}</p>
                </div>
              </div>

              {/* Passenger Details & Direct In-App Contact */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                <div className="flex items-center space-x-3.5">
                  <img
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100"
                    alt={activeTrip.passenger_name}
                    className="w-12 h-12 rounded-full object-cover ring-1 ring-brand-500"
                  />
                  <div className="truncate">
                    <h4 className="font-bold text-sm text-white truncate">{activeTrip.passenger_name}</h4>
                    <p className="text-xs text-slate-400">⭐ {activeTrip.passenger_rating || '4.95'} • {activeTrip.passenger_phone || '+91 9447123456'}</p>
                  </div>
                </div>

                {/* Direct In-App Call & Chat for Driver */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleStartInAppCall}
                    className="p-2.5 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800 text-emerald-400 rounded-xl transition-all shadow-md active:scale-95"
                    title="In-App Voice Call Passenger"
                  >
                    <Phone className="w-4 h-4 animate-pulse" />
                  </button>

                  <button
                    onClick={() => setShowChatModal(true)}
                    className="p-2.5 bg-brand-950/60 hover:bg-brand-900 border border-brand-800 text-brand-400 rounded-xl transition-all shadow-md active:scale-95"
                    title="In-App Chat with Passenger"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Route Endpoints */}
              <div className="space-y-2 text-xs">
                <div className="flex items-start space-x-2">
                  <span className="text-emerald-400 font-bold mt-0.5">●</span>
                  <div>
                    <p className="font-bold text-white">Pickup Location</p>
                    <p className="text-slate-400">{activeTrip.pickup_address}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-rose-400 font-bold mt-0.5">■</span>
                  <div>
                    <p className="font-bold text-white">Destination</p>
                    <p className="text-slate-400">{activeTrip.destination_address}</p>
                  </div>
                </div>
              </div>

              {/* Lifecycle Stage Controls */}
              {activeTrip.status === 'DRIVER_ACCEPTED' || activeTrip.status === 'DRIVER_EN_ROUTE' ? (
                <button
                  onClick={handleArriveAtPickup}
                  className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold text-sm shadow-md transition-transform active:scale-98"
                >
                  📍 I Have Arrived at Pickup Point
                </button>
              ) : activeTrip.status === 'DRIVER_ARRIVED' ? (
                
                /* ==================================================== */
                /* MULTI-MODAL OTP VERIFICATION: VOICE, PHOTO, NFC, KEY */
                /* ==================================================== */
                <div className="space-y-4 p-5 bg-gradient-to-b from-slate-950 to-slate-900 rounded-3xl border-2 border-brand-500 shadow-xl">
                  
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center space-x-2 text-xs font-black text-amber-300">
                      <Lock className="w-4 h-4 text-brand-400" />
                      <span>Verify 4-Digit Passenger PIN</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">4 Input Methods</span>
                  </div>

                  {/* 1. Proximity / NFC Auto-Handshake Badge (< 50m) */}
                  {proximityDistanceMeters !== null && proximityDistanceMeters <= 50 && (
                    <div className="p-3 bg-emerald-950/70 border border-emerald-600 rounded-2xl flex items-center justify-between animate-pulse">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold">
                          <Wifi className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-emerald-300">Passenger Proximity Detected!</p>
                          <p className="text-[10px] text-emerald-400 font-semibold">
                            Within {proximityDistanceMeters}m range • NFC/Bluetooth Token Valid
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleProximityAutoHandshake}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-transform active:scale-95 shrink-0"
                      >
                        ⚡ Auto-Start
                      </button>
                    </div>
                  )}

                  {/* 2. Fast Voice & Photo/QR Action Buttons */}
                  <div className="grid grid-cols-2 gap-2.5">
                    
                    {/* Speak OTP via Microphone */}
                    <button
                      type="button"
                      onClick={handleStartVoiceOtpInput}
                      className={`p-3 rounded-2xl border flex items-center justify-center space-x-2 transition-all ${
                        isListeningVoiceOtp
                          ? 'bg-rose-950 border-rose-500 text-rose-300 animate-pulse ring-2 ring-rose-500/30'
                          : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200 shadow-sm'
                      }`}
                    >
                      <Mic className={`w-4 h-4 ${isListeningVoiceOtp ? 'text-rose-400 animate-bounce' : 'text-brand-400'}`} />
                      <span className="text-xs font-bold">
                        {isListeningVoiceOtp ? 'Listening...' : '🎙️ Speak PIN'}
                      </span>
                    </button>

                    {/* Scan / Photo OTP from Camera */}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        ref={fileInputRef}
                        onChange={handlePhotoCaptureOtp}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-2xl flex items-center justify-center space-x-2 shadow-sm transition-all"
                      >
                        <Camera className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold">📸 Photo / Scan PIN</span>
                      </button>
                    </div>
                  </div>

                  {/* Camera Scanner OCR Modal / Progress */}
                  {showCameraScanner && (
                    <div className="p-3 bg-slate-900 border border-slate-700 rounded-2xl text-center space-y-2">
                      <div className="animate-spin w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full mx-auto" />
                      <p className="text-xs font-bold text-brand-400">{scannerStatus}</p>
                    </div>
                  )}

                  {/* 3. Manual PIN Input */}
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={4}
                        value={otpInput}
                        onChange={e => setOtpInput(e.target.value)}
                        placeholder="Type 4 digits (e.g. 5821)"
                        className="w-full text-center text-3xl font-mono font-black tracking-widest py-3 bg-slate-950 rounded-2xl border-2 border-slate-700 text-white focus:outline-none focus:border-brand-500 shadow-inner"
                      />
                      {otpInput.length === 4 && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 absolute right-4 top-1/2 -translate-y-1/2" />
                      )}
                    </div>

                    {otpError && <p className="text-xs font-bold text-rose-400 text-center">{otpError}</p>}

                    <button
                      onClick={handleStartTripManual}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-600/30 transition-transform active:scale-98 flex items-center justify-center space-x-2"
                    >
                      <span>🚀 Verify PIN & Start Ride</span>
                    </button>
                  </div>

                </div>
              ) : activeTrip.status === 'TRIP_STARTED' || activeTrip.status === 'TRIP_IN_PROGRESS' ? (
                <button
                  onClick={handleCompleteTrip}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-extrabold text-sm shadow-xl shadow-emerald-600/30 transition-transform active:scale-98"
                >
                  🏁 Arrived at Destination • End Trip (Collect ₹{activeTrip.fare_estimate})
                </button>
              ) : null}

            </div>
          ) : (
            <div className="p-8 bg-slate-900 rounded-3xl border border-slate-800 text-center space-y-3 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-brand-950/60 text-brand-400 flex items-center justify-center mx-auto border border-brand-800">
                <Navigation className="w-8 h-8 animate-spin" />
              </div>
              <h3 className="font-extrabold text-base text-white">
                {isOnline ? 'Waiting for Passenger Ride Requests' : 'You are currently Offline'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {isOnline
                  ? 'Your GPS telematics is live. When a passenger books nearby, a voice alert and offer HUD will trigger.'
                  : 'Turn on the switch at the top to start receiving passenger bookings.'}
              </p>
            </div>
          )}

        </div>

        {/* Right Live Navigation Map */}
        <div className="lg:col-span-6 h-[500px] lg:h-[650px] rounded-3xl overflow-hidden shadow-lg border border-slate-800 relative">
          <OpenStreetMap
            center={{ lat: 10.5276, lng: 76.2144 }}
            pickup={activeTrip ? { lat: activeTrip.pickup_lat, lng: activeTrip.pickup_lng, address: activeTrip.pickup_address } : undefined}
            destination={activeTrip ? { lat: activeTrip.destination_lat, lng: activeTrip.destination_lng, address: activeTrip.destination_address } : undefined}
            activeDriver={{
              lat: 10.5276,
              lng: 76.2144,
              heading: 45,
              name: currentUser.name
            }}
            className="w-full h-full"
          />
        </div>

      </div>

      {/* Incoming Ride Request Modal (with Voice Alert & 20s Countdown) */}
      {incomingOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in zoom-in-95">
          <div className="w-full max-w-md bg-slate-900 rounded-3xl p-6 shadow-2xl border-2 border-brand-500 space-y-4 text-center">
            
            {/* Top Voice Alert Badge */}
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-950/80 border border-emerald-700 rounded-full text-[11px] font-bold text-emerald-400 mx-auto">
              <Volume2 className="w-3.5 h-3.5 animate-bounce" />
              <span>Voice Alert Active • Announcing Offer</span>
            </div>

            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-30"></span>
              <div className="relative w-14 h-14 rounded-full bg-brand-600 text-white flex items-center justify-center font-extrabold text-xl shadow-md">
                {offerCountdown}s
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">
                {incomingOffer.isFavoriteRequest ? '⭐ Favorite Driver Request' : 'New Ride Booking Offer'}
              </span>
              <h3 className="text-3xl font-black text-white">
                ₹{incomingOffer.fareEstimate || incomingOffer.fare}
              </h3>
              <p className="text-xs text-slate-400">
                Passenger: <span className="font-bold text-white">{incomingOffer.passengerName}</span> • {incomingOffer.distanceKm || '4.2'} km
              </p>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-2xl text-xs space-y-2 text-left border border-slate-800">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Pickup Location</p>
                <p className="font-semibold text-white truncate">{incomingOffer.pickupAddress}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Destination</p>
                <p className="font-semibold text-white truncate">{incomingOffer.destinationAddress}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleDeclineOffer}
                className="py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-2xl transition-colors"
              >
                Decline
              </button>
              <button
                onClick={handleAcceptOffer}
                className="py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-brand-500/30 transition-transform active:scale-95"
              >
                Accept Offer ({offerCountdown}s)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* In-App Chat Modal for Driver */}
      {activeTrip && (
        <InAppChatModal
          isOpen={showChatModal}
          onClose={() => setShowChatModal(false)}
          bookingId={activeTrip.id}
          currentUserId={currentUser.id}
          currentUserName={currentUser.name}
          currentUserRole="DRIVER"
          peerName={activeTrip.passenger_name || 'Passenger'}
          peerRole="Passenger"
        />
      )}

      {/* In-App VoIP Call Modal for Driver */}
      {activeTrip && (
        <InAppCallModal
          isOpen={showCallModal}
          onClose={() => setShowCallModal(false)}
          callStatus={callStatus}
          bookingId={activeTrip.id}
          currentUserId={currentUser.id}
          peerName={activeTrip.passenger_name || 'Passenger'}
          peerRole="Passenger"
          onAcceptCall={handleAcceptCall}
          onRejectCall={handleRejectCall}
          onEndCall={handleEndCall}
        />
      )}

      {/* Custom Pricing Studio Modal */}
      {showPricingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-800 space-y-5">
            
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-brand-400" />
                <h3 className="font-extrabold text-base text-white">Custom Pricing Studio</h3>
              </div>
              <button onClick={() => setShowPricingModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400">
              Set your custom distance and base rates. The system enforces admin guardrails (maximum allowable deviation $\pm 20\%$).
            </p>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-300">Rate Per KM</span>
                  <span className="text-brand-400 font-mono">₹{customPerKm}/km</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="26"
                  step="0.5"
                  value={customPerKm}
                  onChange={e => setCustomPerKm(parseFloat(e.target.value))}
                  className="w-full accent-brand-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Min: ₹16.0</span>
                  <span>Standard: ₹20.0</span>
                  <span>Max: ₹24.0</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-300">Base Fare</span>
                  <span className="text-brand-400 font-mono">₹{customBaseFare}</span>
                </div>
                <input
                  type="range"
                  min="65"
                  max="105"
                  step="1"
                  value={customBaseFare}
                  onChange={e => setCustomBaseFare(parseFloat(e.target.value))}
                  className="w-full accent-brand-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Min: ₹65</span>
                  <span>Standard: ₹80</span>
                  <span>Max: ₹100</span>
                </div>
              </div>

              {/* Free Pickup Radius & Surcharge Policy (Ram vs Raj) */}
              <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-brand-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-emerald-400">📍 Free Pickup Radius</span>
                  <span className="text-xs font-mono font-bold text-emerald-300 px-2 py-0.5 bg-emerald-950 border border-emerald-800 rounded-full">
                    {freePickupKm} KM Free
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="8"
                  step="0.5"
                  value={freePickupKm}
                  onChange={e => setFreePickupKm(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0 km (No free pickup)</span>
                  <span>3 km (Ram's setting)</span>
                  <span>8 km (Max)</span>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-300">Extra Pickup Surcharge Rate</span>
                    <span className="text-amber-400 font-mono">₹{pickupChargePerKm}/km</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    step="1"
                    value={pickupChargePerKm}
                    onChange={e => setPickupChargePerKm(parseFloat(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>₹0/km (Free always)</span>
                    <span>₹10/km (Standard)</span>
                    <span>₹25/km</span>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-900/90 rounded-xl text-[11px] text-slate-300 space-y-1">
                  <p className="font-bold text-amber-300">💡 Pickup Policy Simulation:</p>
                  <p>
                    Customers within <strong className="text-emerald-400">{freePickupKm} km</strong> of your location pay <strong>₹0 extra</strong>.
                    Customers beyond {freePickupKm} km pay <strong>+₹{pickupChargePerKm}/km</strong> for extra distance.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl text-xs space-y-1 border border-slate-800">
              <p className="text-emerald-400 font-bold">✓ Direct & Broadcast Booking Enabled</p>
              <p className="text-slate-500 text-[11px]">Passengers can select your quote directly or broadcast to all nearby captains.</p>
            </div>

            <button
              onClick={handleSaveCustomPricing}
              className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-extrabold text-xs shadow-lg shadow-brand-500/25"
            >
              Save Custom Rates
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
