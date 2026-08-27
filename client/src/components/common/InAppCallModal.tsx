import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../../services/socket.js';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Shield,
  Sparkles
} from 'lucide-react';

export type CallStatus = 'IDLE' | 'CALLING' | 'INCOMING' | 'CONNECTED' | 'ENDED';

interface InAppCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callStatus: CallStatus;
  bookingId: string;
  currentUserId: string;
  peerName: string;
  peerRole: string;
  peerAvatar?: string;
  virtualNumber?: string;
  onAcceptCall?: () => void;
  onRejectCall?: () => void;
  onEndCall: () => void;
}

export const InAppCallModal: React.FC<InAppCallModalProps> = ({
  isOpen,
  onClose,
  callStatus,
  bookingId,
  currentUserId,
  peerName,
  peerRole,
  peerAvatar,
  virtualNumber = '+91 484-719-0099',
  onAcceptCall,
  onRejectCall,
  onEndCall
}) => {
  const [durationSec, setDurationSec] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const timerRef = useRef<any>(null);

  // Call Duration Timer
  useEffect(() => {
    if (callStatus === 'CONNECTED') {
      setDurationSec(0);
      timerRef.current = setInterval(() => {
        setDurationSec(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-sm bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 rounded-3xl p-8 shadow-2xl border border-slate-800 text-center space-y-6 relative overflow-hidden">
        
        {/* Ambient Pulsing Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Safe Relay Banner */}
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-950/60 border border-emerald-800/60 rounded-full text-[10px] font-bold text-emerald-400">
          <Shield className="w-3 h-3" />
          <span>Encrypted Voice Call • Relay {virtualNumber}</span>
        </div>

        {/* Peer Avatar with Pulse Rings */}
        <div className="relative mx-auto w-28 h-28 flex items-center justify-center">
          {callStatus === 'CONNECTED' && (
            <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
          )}
          {callStatus === 'CALLING' && (
            <span className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping" />
          )}
          <img
            src={peerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
            alt={peerName}
            className="w-24 h-24 rounded-full object-cover ring-4 ring-slate-800 shadow-2xl relative z-10"
          />
        </div>

        {/* Name & Call State */}
        <div className="space-y-1 z-10 relative">
          <h3 className="text-xl font-black text-white">{peerName}</h3>
          <p className="text-xs text-slate-400 font-medium">{peerRole}</p>
          
          <div className="pt-2">
            {callStatus === 'CALLING' && (
              <p className="text-xs font-bold text-brand-400 animate-pulse">
                Calling via In-App Relay...
              </p>
            )}
            {callStatus === 'INCOMING' && (
              <p className="text-xs font-bold text-amber-400 animate-bounce">
                Incoming In-App Voice Call...
              </p>
            )}
            {callStatus === 'CONNECTED' && (
              <div className="space-y-2">
                <p className="text-lg font-mono font-black text-emerald-400 tracking-wider">
                  {formatTimer(durationSec)}
                </p>
                {/* Audio Waveform Bars */}
                <div className="flex items-center justify-center space-x-1 h-6">
                  {[40, 75, 55, 90, 60, 80, 45, 70, 85, 50].map((h, i) => (
                    <span
                      key={i}
                      className="w-1 bg-emerald-400/80 rounded-full animate-pulse"
                      style={{
                        height: `${h}%`,
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: '0.8s'
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            {callStatus === 'ENDED' && (
              <p className="text-xs font-bold text-rose-400">Call Ended</p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-4 border-t border-slate-800/80 z-10 relative">
          
          {/* Incoming Call: Accept or Decline */}
          {callStatus === 'INCOMING' ? (
            <div className="flex items-center justify-center space-x-8">
              <button
                onClick={onRejectCall}
                className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-transform active:scale-90"
                title="Decline Call"
              >
                <PhoneOff className="w-6 h-6" />
              </button>

              <button
                onClick={onAcceptCall}
                className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 animate-bounce transition-transform active:scale-90"
                title="Accept Call"
              >
                <PhoneCall className="w-6 h-6" />
              </button>
            </div>
          ) : (
            /* Calling or Connected: Mute, Speaker, End Call */
            <div className="flex items-center justify-center space-x-5">
              {callStatus === 'CONNECTED' && (
                <>
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isMuted
                        ? 'bg-rose-950/60 border-rose-800 text-rose-400'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  <button
                    onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      !isSpeakerOn
                        ? 'bg-slate-800 border-slate-700 text-slate-500'
                        : 'bg-brand-950/60 border-brand-800 text-brand-400'
                    }`}
                    title="Speaker"
                  >
                    {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  </button>
                </>
              )}

              <button
                onClick={onEndCall}
                className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-transform active:scale-90"
                title="End Call"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
