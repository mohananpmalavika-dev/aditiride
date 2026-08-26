import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Booking, User, LanguageCode } from '../../types/index.js';
import { api } from '../../services/api.js';
import { getSocket } from '../../services/socket.js';
import { t } from '../../i18n/translations.js';
import { OpenStreetMap } from '../common/OpenStreetMap.js';
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
  Car
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

  // Modals & Drawers
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [showMaskedCall, setShowMaskedCall] = useState(false);
  const [maskedCallData, setMaskedCallData] = useState<any>(null);
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Rating & Completion
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Smooth Driving', 'Polite', 'Clean Car']);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [addToFavorites, setAddToFavorites] = useState(true);

  const socket = getSocket();

  const fetchBookingData = async () => {
    try {
      const res = await api.getBooking(bookingId);
      setBooking(res.booking);

      if (res.booking) {
        // Calculate road route polyline
        const routeRes = await api.calculateRoute(
          { lat: res.booking.pickup_lat, lng: res.booking.pickup_lng },
          { lat: res.booking.destination_lat, lng: res.booking.destination_lng }
        );
        setRoutePolyline(routeRes.route.polyline);

        if (res.booking.driver_lat && res.booking.driver_lng) {
          setDriverLocation({
            lat: res.booking.driver_lat,
            lng: res.booking.driver_lng,
            heading: res.booking.driver_heading || 0
          });
        }

        if (res.booking.status === 'COMPLETED') {
          setShowRatingModal(true);
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        }
      }
    } catch (err) {
      console.error('Failed to load booking:', err);
    }
  };

  useEffect(() => {
    fetchBookingData();
    socket.emit('join_booking', bookingId);

    // Socket.IO listeners
    socket.on('driver_moved', (data: any) => {
      setDriverLocation({ lat: data.lat, lng: data.lng, heading: data.heading });
    });

    socket.on('booking_status_changed', (data: any) => {
      if (data.bookingId === bookingId) {
        setBooking(data.booking);
        if (data.booking.status === 'COMPLETED') {
          setShowRatingModal(true);
          confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
        }
      }
    });

    socket.on('new_chat_message', (msg: any) => {
      setChatMessages(prev => [...prev, msg]);
    });

    // Initial chat fetch
    api.getChatMessages(bookingId).then(res => setChatMessages(res.messages || [])).catch(() => {});

    // Polling backup every 5s
    const interval = setInterval(fetchBookingData, 5000);
    return () => {
      clearInterval(interval);
      socket.off('driver_moved');
      socket.off('booking_status_changed');
      socket.off('new_chat_message');
    };
  }, [bookingId]);

  const handleSendChat = async (textToSend?: string) => {
    const msg = textToSend || newMessageText;
    if (!msg.trim()) return;

    try {
      socket.emit('send_chat_message', {
        bookingId,
        senderId: currentUser.id,
        senderRole: 'PASSENGER',
        message: msg
      });
      setNewMessageText('');
    } catch (err) {
      console.error('Chat error:', err);
    }
  };

  const handleTriggerSOS = async () => {
    try {
      const lat = driverLocation?.lat || booking?.pickup_lat || 10.5276;
      const lng = driverLocation?.lng || booking?.pickup_lng || 76.2144;
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

  const handleOpenMaskedCall = async () => {
    try {
      const res = await api.getMaskedCallSession(bookingId, currentUser.id);
      setMaskedCallData(res);
      setShowMaskedCall(true);
    } catch (err) {
      console.error('Call mask error:', err);
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
    if (!confirm('Are you sure you want to cancel this ride?')) return;
    try {
      await api.transitionBooking(bookingId, {
        status: 'CANCELLED_BY_PASSENGER',
        triggeredByUserId: currentUser.id,
        cancellationReason: 'Passenger requested cancellation'
      });
      onTripFinished();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!booking) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full mr-3" />
        <span>Connecting to live driver telematics...</span>
      </div>
    );
  }

  const isDriverAssigned = [
    'DRIVER_ASSIGNED',
    'DRIVER_ACCEPTED',
    'DRIVER_EN_ROUTE',
    'DRIVER_ARRIVED',
    'TRIP_STARTED',
    'TRIP_IN_PROGRESS'
  ].includes(booking.status);

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      
      {/* Top Status Header */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
            <Car className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300">
                {booking.status.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-slate-400 font-mono">#{booking.booking_number}</span>
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md mt-0.5">
              {booking.destination_address}
            </p>
          </div>
        </div>

        {/* SOS Button */}
        <button
          onClick={() => setShowSOSModal(true)}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-extrabold text-xs shadow-md shadow-rose-500/30 transition-transform active:scale-95 animate-pulse"
        >
          <AlertTriangle className="w-4 h-4" />
          <span>SOS</span>
        </button>
      </div>

      {/* Interactive Live Leaflet Map */}
      <div className="relative w-full h-[380px] rounded-3xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800">
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
                  name: booking.driver_name || 'Driver'
                }
              : undefined
          }
          className="w-full h-full"
        />

        {/* 4-Digit OTP Floating Badge */}
        {booking.status !== 'COMPLETED' && booking.status !== 'CANCELLED_BY_PASSENGER' && (
          <div className="absolute top-4 left-4 z-[400] bg-slate-900/90 text-white backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl border border-white/20 flex items-center space-x-3">
            <Lock className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Start Ride PIN</p>
              <p className="text-xl font-extrabold tracking-widest text-white">{booking.otp_code}</p>
            </div>
          </div>
        )}
      </div>

      {/* Driver Card & Actions HUD */}
      {isDriverAssigned && (
        <div className="p-5 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3.5">
              <img
                src={booking.driver_avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'}
                alt={booking.driver_name}
                className="w-14 h-14 rounded-2xl object-cover ring-2 ring-brand-500 shadow-md"
              />
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="font-extrabold text-base text-slate-900 dark:text-white">{booking.driver_name}</h4>
                  <span className="flex items-center text-xs font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-md">
                    ★ {booking.driver_rating || '4.9'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {booking.vehicle_brand} {booking.vehicle_model} • <span className="font-semibold text-slate-800 dark:text-slate-200">{booking.vehicle_color}</span>
                </p>
                <p className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400 mt-0.5">
                  {booking.vehicle_plate}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-400">Estimated Fare</p>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white">₹{booking.fare_estimate}</p>
              <p className="text-[10px] text-slate-400">{booking.payment_method}</p>
            </div>
          </div>

          {/* Action Buttons: Masked Call, Chat, Share, Cancel */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleOpenMaskedCall}
              className="flex flex-col items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-brand-50 rounded-2xl text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
            >
              <Phone className="w-4 h-4 mb-1 text-emerald-600" />
              <span>Call</span>
            </button>

            <button
              onClick={() => setShowChat(true)}
              className="flex flex-col items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-brand-50 rounded-2xl text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors relative"
            >
              <MessageSquare className="w-4 h-4 mb-1 text-brand-600" />
              <span>Chat</span>
              {chatMessages.length > 0 && (
                <span className="absolute top-1 right-3 w-2 h-2 bg-brand-500 rounded-full" />
              )}
            </button>

            <button
              onClick={handleShareTrip}
              className="flex flex-col items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-brand-50 rounded-2xl text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
            >
              <Share2 className="w-4 h-4 mb-1 text-blue-600" />
              <span>{shareCopied ? 'Copied!' : 'Share'}</span>
            </button>

            <button
              onClick={handleCancelBooking}
              className="flex flex-col items-center justify-center p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-2xl text-rose-600 font-semibold text-xs transition-colors"
            >
              <X className="w-4 h-4 mb-1" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}

      {/* In-Trip Chat Drawer / Modal */}
      {showChat && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col h-[500px] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Chat with {booking.driver_name || 'Driver'}
                </h3>
              </div>
              <button onClick={() => setShowChat(false)} className="p-1 rounded-full text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Message Stream */}
            <div className="flex-1 p-4 overflow-y-auto space-y-2.5 bg-slate-50/50 dark:bg-slate-950/50">
              {chatMessages.length === 0 ? (
                <p className="text-xs text-slate-400 text-center my-6">No messages yet. Send a quick update to your driver!</p>
              ) : (
                chatMessages.map((msg, i) => {
                  const isMe = msg.senderRole === 'PASSENGER';
                  return (
                    <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-xs font-medium ${
                          isMe
                            ? 'bg-brand-600 text-white rounded-br-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-sm'
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Preset Buttons */}
            <div className="p-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center space-x-1.5 overflow-x-auto text-[11px]">
              {["I'm at the entrance", 'Please wait 2 mins', 'Where are you?', 'I have arrived'].map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendChat(preset)}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 rounded-full shrink-0 text-slate-600 dark:text-slate-300 font-medium"
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center space-x-2">
              <input
                type="text"
                value={newMessageText}
                onChange={e => setNewMessageText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                placeholder="Type a message..."
                className="flex-1 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                onClick={() => handleSendChat()}
                className="p-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-md transition-transform active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Masked Call Dialog */}
      {showMaskedCall && maskedCallData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 text-center shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <Phone className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Anonymized Private Calling</h3>
            <p className="text-xs text-slate-500 mt-1">Your personal phone number is protected and hidden from the driver.</p>

            <div className="my-4 p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Virtual Bridge Number</p>
              <p className="text-lg font-mono font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {maskedCallData.virtualNumber}
              </p>
            </div>

            <button
              onClick={() => setShowMaskedCall(false)}
              className="w-full py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* SOS Emergency Modal */}
      {showSOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-rose-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 text-center shadow-2xl border-2 border-rose-500">
            <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center mx-auto mb-3 ring-4 ring-rose-500/20">
              <Shield className="w-8 h-8" />
            </div>
            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Aditi Safety Shield</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Triggering SOS immediately notifies our 24/7 Safety Command Center, your emergency contacts, and shares live telematics.
            </p>

            {sosActive ? (
              <div className="my-4 p-4 bg-rose-50 dark:bg-rose-950/50 rounded-2xl border border-rose-200 dark:border-rose-800 text-left">
                <p className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                  <span>SOS Broadcast Active</span>
                </p>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                  National Helpline: <b>112</b><br/>
                  Kerala Police Emergency: <b>+91 487 242 4100</b>
                </p>
              </div>
            ) : (
              <button
                onClick={handleTriggerSOS}
                className="w-full mt-5 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-extrabold text-sm shadow-xl shadow-rose-600/30 transition-transform active:scale-95"
              >
                🚨 Trigger Emergency Alert Now
              </button>
            )}

            <button
              onClick={() => setShowSOSModal(false)}
              className="w-full mt-3 py-2 text-slate-400 hover:text-slate-600 text-xs font-semibold"
            >
              Cancel & Return to Trip
            </button>
          </div>
        </div>
      )}

      {/* Post-Trip Rating & Invoice Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 text-center shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">Trip Completed!</h3>
              <p className="text-xs text-slate-500 mt-0.5">Thank you for riding with AditiRide</p>
            </div>

            {/* Digital Receipt Summary */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-left space-y-2 border border-slate-200/80 dark:border-slate-700/80 text-xs">
              <div className="flex justify-between font-bold text-slate-900 dark:text-white text-sm pb-1 border-b border-slate-200 dark:border-slate-700">
                <span>Final Fare</span>
                <span className="text-emerald-600 dark:text-emerald-400">₹{booking.final_fare || booking.fare_estimate}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Distance & Duration</span>
                <span>{booking.distance_km} km • {booking.duration_min} mins</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Payment Method</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{booking.payment_method} (Settled)</span>
              </div>
            </div>

            {/* 5-Star Rating Selector */}
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Rate your driver {booking.driver_name}</p>
              <div className="flex items-center justify-center space-x-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRatingScore(star)}
                    className="p-1 hover:scale-125 transition-transform"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= ratingScore ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-700'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Favorite Driver Toggle */}
            <div className="p-3 bg-brand-50/70 dark:bg-brand-950/40 rounded-2xl border border-brand-200 dark:border-brand-800/60 flex items-center justify-between text-left">
              <div className="flex items-center space-x-2.5">
                <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Save {booking.driver_name} as Favorite?</p>
                  <p className="text-[10px] text-slate-500">You can request this driver directly next time</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={addToFavorites}
                onChange={e => setAddToFavorites(e.target.checked)}
                className="w-5 h-5 accent-brand-600 rounded cursor-pointer"
              />
            </div>

            <button
              onClick={handleSubmitRating}
              className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-brand-500/20"
            >
              Submit & Done
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
