import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Booking, User, LanguageCode } from '../../types/index.js';
import { api } from '../../services/api.js';
import { getSocket } from '../../services/socket.js';
import { t } from '../../i18n/translations.js';
import { OpenStreetMap } from '../common/OpenStreetMap.js';
import { InAppChatModal } from '../common/InAppChatModal.js';
import { InAppCallModal, CallStatus } from '../common/InAppCallModal.js';
import {
  Shield,
  Phone,
  MessageSquare,
  Share2,
  AlertTriangle,
  Star,
  CheckCircle,
  X,
  Heart,
  Navigation,
  Clock,
  Send,
  Lock,
  Download,
  Car,
  Volume2,
  QrCode
} from 'lucide-react';

interface LiveTrackingViewProps {
  bookingId: string;
  currentUser: User;
  language: LanguageCode;
  onTripFinished: () => void;
}

export const LiveTrackingView: React.FC<LiveTrackingViewProps> = ({
  bookingId,
  currentUser,
  language,
  onTripFinished
}) => {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number; heading?: number } | null>(null);
  const [passengerLocation, setPassengerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const hasAnnouncedArrivalRef = useRef(false);

  // In-App Chat & VoIP Call Modals
  const [showChatModal, setShowChatModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>('IDLE');
  const [callSessionId, setCallSessionId] = useState<string>('');

  const [showSOSModal, setShowSOSModal] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [addToFavorites, setAddToFavorites] = useState(false);

  const socket = getSocket();

  // Play Pleasant Melodic Arrival Chime
  const playArrivalChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.3); // G5
      osc.frequency.setValueAtTime(1046.50, now + 0.45); // C6

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.9);
    } catch {}
  };

  // Voice Announcement to Passenger when Driver Arrives
  const speakDriverArrived = (b: Booking) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const driver = b.driver_name || 'Your Captain';
    const vehicle = `${b.vehicle_color || ''} ${b.vehicle_brand || ''} ${b.vehicle_model || ''}`.trim();
    const otp = b.otp_code;

    let spokenText = '';
    let voiceLang = 'en-IN';

    if (language === 'ml' || currentUser.preferred_language === 'ml') {
      spokenText = `നിങ്ങളുടെ ക്യാപ്റ്റൻ ${driver} എത്തിയിട്ടുണ്ട്! വാഹനം ${vehicle}. ദയവായി നിങ്ങളുടെ സ്റ്റാർട്ട് പിൻ ${otp} ക്യാപ്റ്റനുമായി പങ്കിടുക.`;
      voiceLang = 'ml-IN';
    } else if (language === 'hi' || currentUser.preferred_language === 'hi') {
      spokenText = `आपके कैप्टन ${driver} पिकअप लोकेशन पर पहुंच चुके हैं! आपका 4 अंकों का पिन ${otp} है।`;
      voiceLang = 'hi-IN';
    } else if (language === 'ta' || currentUser.preferred_language === 'ta') {
      spokenText = `உங்கள் கேப்டன் ${driver} வந்துவிட்டார்! உங்கள் பின் ${otp}.`;
      voiceLang = 'ta-IN';
    } else {
      spokenText = `Your captain ${driver} has arrived at the pickup location in a ${vehicle}! Your start ride PIN is ${otp}.`;
      voiceLang = 'en-IN';
    }

    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = voiceLang;
    utterance.rate = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Load active booking data & listen to real-time events
  useEffect(() => {
    loadBookingData();

    socket.emit('join_user', currentUser.id);
    socket.emit('join_booking', bookingId);

    // Driver location update
    const handleDriverMoved = (data: { driverId: string; lat: number; lng: number; heading?: number }) => {
      setDriverLocation({ lat: data.lat, lng: data.lng, heading: data.heading || 0 });
    };

    // Booking status change
    const handleStatusChanged = (data: { bookingId: string; status: string; booking: any }) => {
      if (data.bookingId === bookingId) {
        setBooking(data.booking);
        
        // Trigger voice alert when driver arrives!
        if (data.status === 'DRIVER_ARRIVED' && !hasAnnouncedArrivalRef.current) {
          hasAnnouncedArrivalRef.current = true;
          playArrivalChime();
          setTimeout(() => speakDriverArrived(data.booking), 300);
        }

        if (data.status === 'COMPLETED') {
          setShowRatingModal(true);
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
      }
    };

    // In-App Call Socket Listeners
    const handleIncomingCall = (callData: any) => {
      if (callData.bookingId === bookingId || callData.receiverId === currentUser.id) {
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

    socket.on('driver_moved', handleDriverMoved);
    socket.on('booking_status_changed', handleStatusChanged);
    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_connected', handleCallConnected);
    socket.on('call_declined', handleCallDeclined);
    socket.on('call_ended', handleCallEnded);

    // Mutual Two-Way Real-Time Location Sharing: Stream passenger GPS position to driver
    let watchId: number | null = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        pos => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const heading = pos.coords.heading || 0;
          const accuracy = pos.coords.accuracy || 10;
          const speed = pos.coords.speed || 0;

          setPassengerLocation({ lat, lng });

          // Emit live position to driver and booking room
          socket.emit('passenger_location_update', {
            bookingId,
            lat,
            lng,
            heading,
            accuracy,
            speed
          });
        },
        err => {
          console.warn('Passenger GPS watch notification:', err);
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );
    }

    // Fallback polling only when socket is disconnected
    const interval = setInterval(() => {
      if (!socket.connected) {
        loadBookingData();
      }
    }, 10000);

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      clearInterval(interval);
      socket.off('driver_moved', handleDriverMoved);
      socket.off('booking_status_changed', handleStatusChanged);
      socket.off('incoming_call', handleIncomingCall);
      socket.off('call_connected', handleCallConnected);
      socket.off('call_declined', handleCallDeclined);
      socket.off('call_ended', handleCallEnded);
    };
  }, [bookingId]);

  const loadBookingData = async () => {
    try {
      const res = await api.getBooking(bookingId);
      if (res.booking) {
        setBooking(res.booking);

        if (res.booking.driver_lat && res.booking.driver_lng) {
          setDriverLocation({
            lat: res.booking.driver_lat,
            lng: res.booking.driver_lng,
            heading: res.booking.driver_heading
          });
        }

        // Trigger arrival voice announcement if just arrived
        if (res.booking.status === 'DRIVER_ARRIVED' && !hasAnnouncedArrivalRef.current) {
          hasAnnouncedArrivalRef.current = true;
          playArrivalChime();
          setTimeout(() => speakDriverArrived(res.booking), 300);
        }

        // Fetch polyline route if not loaded
        if (routePolyline.length === 0) {
          api.calculateRoute(
            { lat: res.booking.pickup_lat, lng: res.booking.pickup_lng },
            { lat: res.booking.destination_lat, lng: res.booking.destination_lng }
          ).then(routeRes => {
            if (routeRes.route?.polyline) setRoutePolyline(routeRes.route.polyline);
            else if (routeRes.polyline) setRoutePolyline(routeRes.polyline);
          }).catch(() => {});
        }

        if (res.booking.status === 'COMPLETED' && !showRatingModal) {
          setShowRatingModal(true);
        }
      }
    } catch (err) {
      console.error('Error fetching booking in live tracking:', err);
    }
  };

  // Call Actions
  const handleStartInAppCall = () => {
    if (!booking) return;
    const newCallSession = `call_${Date.now()}`;
    setCallSessionId(newCallSession);
    setCallStatus('CALLING');
    setShowCallModal(true);

    socket.emit('call_initiate', {
      bookingId,
      callSessionId: newCallSession,
      callerId: currentUser.id,
      callerName: currentUser.name,
      callerRole: 'PASSENGER',
      callerAvatar: currentUser.avatar_url,
      receiverId: booking.driver_id,
      receiverName: booking.driver_name || 'Captain'
    });
  };

  const handleAcceptCall = () => {
    setCallStatus('CONNECTED');
    socket.emit('call_accept', {
      bookingId,
      callSessionId,
      callerId: booking?.driver_id,
      receiverId: currentUser.id
    });
  };

  const handleRejectCall = () => {
    setCallStatus('ENDED');
    setShowCallModal(false);
    socket.emit('call_reject', {
      bookingId,
      callSessionId,
      callerId: booking?.driver_id,
      receiverId: currentUser.id
    });
  };

  const handleEndCall = () => {
    setCallStatus('ENDED');
    socket.emit('call_end', {
      bookingId,
      callSessionId,
      endedBy: currentUser.name
    });
    setTimeout(() => setShowCallModal(false), 800);
  };

  const handleTriggerSOS = async () => {
    if (!booking) return;
    const lat = driverLocation?.lat || booking.pickup_lat;
    const lng = driverLocation?.lng || booking.pickup_lng;
    try {
      await api.triggerSOS({
        bookingId,
        triggeredByUserId: currentUser.id,
        lat,
        lng,
        notes: 'Emergency SOS button tapped in live ride'
      });
      setSosActive(true);
      socket.emit('sos_broadcast', { bookingId, userId: currentUser.id, lat, lng });
    } catch (err) {
      console.error('SOS error:', err);
    }
  };

  const handleShareTrip = async () => {
    try {
      const res = await api.getLiveShareToken(bookingId);
      const fullUrl = `${window.location.origin}${res.shareUrl}`;
      navigator.clipboard.writeText(fullUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 3000);
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const handleSubmitRating = async () => {
    if (!booking) return;
    try {
      if (booking.driver_id) {
        await api.rateBooking(booking.id, {
          raterId: currentUser.id,
          ratedUserId: booking.driver_id,
          rating: ratingScore,
          tags: selectedTags,
          comment: feedbackComment
        });

        if (addToFavorites) {
          await api.addFavoriteDriver(booking.driver_id, currentUser.id);
        }
      }
      setShowRatingModal(false);
      onTripFinished();
    } catch (err) {
      console.error('Rating submission error:', err);
      onTripFinished();
    }
  };

  const handleCancelBooking = async () => {
    if (!confirm('Are you sure you want to cancel this booking? A cancellation fee may apply.')) return;
    try {
      await api.cancelBooking(bookingId, currentUser.id, 'PASSENGER', 'Passenger cancelled in app');
      onTripFinished();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel booking');
    }
  };

  if (!booking) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center space-y-3">
          <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm font-bold text-slate-400">Connecting to Live Ride Telematics...</p>
        </div>
      </div>
    );
  }

  const isDriverAssigned = !!booking.driver_id;
  const isTripStarted = booking.status === 'TRIP_STARTED' || booking.status === 'TRIP_IN_PROGRESS';
  const isDriverArrived = booking.status === 'DRIVER_ARRIVED';

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      
      {/* Top Emergency & Status Banner */}
      <div className="flex items-center justify-between p-4 bg-slate-900 rounded-3xl shadow-sm border border-slate-800">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
            isDriverArrived ? 'bg-emerald-950 text-emerald-400 animate-pulse' : 'bg-brand-500/10 text-brand-400'
          }`}>
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-sm text-white">
                {isDriverArrived ? 'CAPTAIN ARRIVED AT PICKUP' : booking.status.replace(/_/g, ' ')}
              </span>
              <span className="text-[10px] font-mono font-bold text-brand-400 bg-brand-950 px-2 py-0.5 rounded-full border border-brand-800">
                #{booking.booking_number}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              {isTripStarted
                ? 'Ride is in progress to destination'
                : isDriverArrived
                ? 'Captain is waiting at your location. Share your OTP / QR.'
                : isDriverAssigned
                ? 'Captain is en route to your pickup point'
                : 'Searching for the best rated captain nearby...'}
            </p>
          </div>
        </div>

        {/* SOS Emergency Button */}
        <button
          onClick={() => setShowSOSModal(true)}
          className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-extrabold text-xs shadow-lg shadow-rose-600/25 transition-transform active:scale-95 flex items-center space-x-1.5"
        >
          <AlertTriangle className="w-4 h-4 animate-bounce" />
          <span>SOS</span>
        </button>
      </div>

      {/* Interactive Live Map Canvas */}
      <div className="relative w-full h-[400px] lg:h-[450px] rounded-3xl overflow-hidden shadow-xl border border-slate-800">
        <OpenStreetMap
          center={{ lat: booking.pickup_lat, lng: booking.pickup_lng }}
          pickup={{ lat: booking.pickup_lat, lng: booking.pickup_lng, address: booking.pickup_address }}
          destination={{ lat: booking.destination_lat, lng: booking.destination_lng, address: booking.destination_address }}
          routePolyline={routePolyline}
          activeDriver={
            driverLocation
              ? {
                  lat: driverLocation.lat,
                  lng: driverLocation.lng,
                  heading: driverLocation.heading,
                  name: booking.driver_name || 'Captain'
                }
              : undefined
          }
          passengerLiveLocation={
            passengerLocation
              ? {
                  lat: passengerLocation.lat,
                  lng: passengerLocation.lng,
                  name: currentUser.name
                }
              : undefined
          }
          className="w-full h-full"
        />

        {/* Mutual Two-Way Realtime Sharing Indicator */}
        <div className="absolute top-4 right-4 z-[400] bg-slate-900/90 text-white backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-emerald-500/50 flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[11px] font-extrabold text-emerald-400">📡 Live Mutual GPS Active</span>
        </div>

        {/* 4-Digit OTP & QR Code Floating Card */}
        {booking.status !== 'COMPLETED' && booking.status !== 'CANCELLED_BY_PASSENGER' && (
          <div className="absolute top-4 left-4 z-[400] bg-slate-900/95 text-white backdrop-blur-md px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-400 flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-emerald-400 tracking-wider">Start Ride PIN</p>
              <p className="text-2xl font-black tracking-widest text-white">{booking.otp_code}</p>
            </div>
          </div>
        )}
      </div>

      {/* Driver Arrival Notice Banner */}
      {isDriverArrived && (
        <div className="p-4 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/80 border-2 border-emerald-500 rounded-3xl flex items-center justify-between animate-in zoom-in-95 shadow-lg shadow-emerald-500/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              <Volume2 className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-white">Captain Has Arrived!</h4>
              <p className="text-xs text-emerald-300">
                Share your PIN <span className="font-black text-white bg-emerald-900 px-2 py-0.5 rounded-md font-mono">{booking.otp_code}</span> with Captain {booking.driver_name}.
              </p>
            </div>
          </div>

          <button
            onClick={() => speakDriverArrived(booking)}
            className="px-3 py-1.5 bg-emerald-900 hover:bg-emerald-800 text-emerald-200 rounded-xl text-xs font-bold border border-emerald-700 flex items-center space-x-1"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Replay Voice</span>
          </button>
        </div>
      )}

      {/* Driver Card & Inbuilt Actions */}
      {isDriverAssigned && (
        <div className="p-5 bg-slate-900 rounded-3xl shadow-sm border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3.5">
              <img
                src={booking.driver_avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'}
                alt={booking.driver_name}
                className="w-14 h-14 rounded-2xl object-cover ring-2 ring-brand-500 shadow-md"
              />
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="font-extrabold text-base text-white">{booking.driver_name}</h4>
                  <span className="flex items-center text-xs font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded-md border border-amber-800/60">
                    ★ {booking.driver_rating || '4.9'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  {booking.vehicle_brand} {booking.vehicle_model} • <span className="font-semibold text-slate-200">{booking.vehicle_color}</span>
                </p>
                <p className="text-xs font-mono font-bold text-brand-400 mt-0.5">
                  {booking.vehicle_plate}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-400">Estimated Fare</p>
              <p className="text-xl font-extrabold text-white">₹{booking.fare_estimate}</p>
              <p className="text-[10px] text-slate-400">{booking.payment_method}</p>
            </div>
          </div>

          {/* Action Grid: In-App Call, In-App Chat, Live Share, Cancel */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800">
            
            {/* Inbuilt Call Button */}
            <button
              onClick={handleStartInAppCall}
              className="flex flex-col items-center justify-center p-2.5 bg-slate-950 hover:bg-emerald-950/40 rounded-2xl text-slate-200 font-semibold text-xs border border-slate-800 hover:border-emerald-800/80 transition-all active:scale-95"
            >
              <Phone className="w-4 h-4 mb-1 text-emerald-400 animate-pulse" />
              <span>In-App Call</span>
            </button>

            {/* Inbuilt Chat Button */}
            <button
              onClick={() => setShowChatModal(true)}
              className="flex flex-col items-center justify-center p-2.5 bg-slate-950 hover:bg-brand-950/40 rounded-2xl text-slate-200 font-semibold text-xs border border-slate-800 hover:border-brand-800/80 transition-all active:scale-95"
            >
              <MessageSquare className="w-4 h-4 mb-1 text-brand-400" />
              <span>Live Chat</span>
            </button>

            {/* Live Share Link */}
            <button
              onClick={handleShareTrip}
              className="flex flex-col items-center justify-center p-2.5 bg-slate-950 hover:bg-slate-800 rounded-2xl text-slate-200 font-semibold text-xs border border-slate-800 transition-all active:scale-95"
            >
              <Share2 className="w-4 h-4 mb-1 text-blue-400" />
              <span>{shareCopied ? 'Copied!' : 'Share Trip'}</span>
            </button>

            {/* Cancel Button */}
            <button
              onClick={handleCancelBooking}
              className="flex flex-col items-center justify-center p-2.5 bg-slate-950 hover:bg-rose-950/40 rounded-2xl text-rose-400 font-semibold text-xs border border-slate-800 hover:border-rose-900 transition-all active:scale-95"
            >
              <X className="w-4 h-4 mb-1" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}

      {/* Inbuilt Chat Modal */}
      <InAppChatModal
        isOpen={showChatModal}
        onClose={() => setShowChatModal(false)}
        bookingId={bookingId}
        currentUserId={currentUser.id}
        currentUserName={currentUser.name}
        currentUserRole="PASSENGER"
        peerName={booking.driver_name || 'Captain'}
        peerRole="Captain"
        peerAvatar={booking.driver_avatar}
      />

      {/* Inbuilt VoIP Audio Call Modal */}
      <InAppCallModal
        isOpen={showCallModal}
        onClose={() => setShowCallModal(false)}
        callStatus={callStatus}
        bookingId={bookingId}
        currentUserId={currentUser.id}
        peerName={booking.driver_name || 'Captain'}
        peerRole="Captain"
        peerAvatar={booking.driver_avatar}
        onAcceptCall={handleAcceptCall}
        onRejectCall={handleRejectCall}
        onEndCall={handleEndCall}
      />

      {/* 5-Star Rating & Favorite Driver Modal on Completion */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in zoom-in-95">
          <div className="w-full max-w-md bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-800 space-y-5 text-center text-slate-100">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto ring-4 ring-emerald-500/20">
              <CheckCircle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-white">Ride Completed!</h3>
              <p className="text-xs text-slate-400">Total settled: ₹{booking.final_fare || booking.fare_estimate}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-300">Rate your experience with {booking.driver_name}</p>
              <div className="flex items-center justify-center space-x-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRatingScore(star)}
                    className="p-1 text-2xl transition-transform hover:scale-125 focus:outline-none"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= ratingScore ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Favorite Captain Toggle */}
            <div
              onClick={() => setAddToFavorites(!addToFavorites)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                addToFavorites
                  ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center space-x-2.5 text-xs font-bold">
                <Heart className={`w-4 h-4 ${addToFavorites ? 'fill-rose-500 text-rose-500' : ''}`} />
                <span>Add {booking.driver_name} to Favorite Captains</span>
              </div>
              <input type="checkbox" checked={addToFavorites} readOnly className="rounded text-rose-600" />
            </div>

            <button
              onClick={handleSubmitRating}
              className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-extrabold text-sm shadow-xl shadow-brand-500/25 transition-transform active:scale-95"
            >
              Submit & Finish
            </button>
          </div>
        </div>
      )}

      {/* SOS Emergency Modal */}
      {showSOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-rose-950/80 backdrop-blur-md animate-in zoom-in-95">
          <div className="w-full max-w-md bg-slate-900 rounded-3xl p-6 shadow-2xl border-2 border-rose-600 space-y-4 text-center text-slate-100">
            <div className="w-16 h-16 rounded-full bg-rose-600/20 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 animate-bounce" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-white">Emergency SOS Response</h3>
              <p className="text-xs text-slate-400">
                Triggering SOS broadcasts your live GPS coordinates directly to Kerala Police (112) and our 24/7 Safety Command Center.
              </p>
            </div>

            {sosActive ? (
              <div className="p-3 bg-emerald-950/80 border border-emerald-700 rounded-2xl text-xs font-bold text-emerald-300">
                ✅ SOS Alert Dispatched! Safety team is monitoring your ride.
              </div>
            ) : (
              <button
                onClick={handleTriggerSOS}
                className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-extrabold text-base shadow-xl shadow-rose-600/40 animate-pulse"
              >
                🚨 Broadcast Emergency Alert Now
              </button>
            )}

            <button
              onClick={() => setShowSOSModal(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
