import React, { useState, useEffect } from 'react';
import { LanguageCode } from '../../types/index.js';
import { api } from '../../services/api.js';
import {
  Mic,
  MicOff,
  Volume2,
  CheckCircle,
  X,
  Sparkles,
  Navigation,
  Clock,
  Car,
  Compass
} from 'lucide-react';

interface VoiceBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: LanguageCode;
  onConfirmBooking: (parsedData: any) => void;
  currentLat?: number;
  currentLng?: number;
}

export const VoiceBookingModal: React.FC<VoiceBookingModalProps> = ({
  isOpen,
  onClose,
  language,
  onConfirmBooking,
  currentLat = 10.5276,
  currentLng = 76.2144
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedResult, setParsedResult] = useState<any | null>(null);
  const [audioFeedbackPlaying, setAudioFeedbackPlaying] = useState(false);

  // Sample quick utterances in active language
  const samplePrompts: Record<LanguageCode, string[]> = {
    ml: [
      'എനിക്ക് ലുലു മാളിലേക്ക് ഒരു ഓട്ടോ വേണം',
      'നാളെ രാവിലെ 7 മണിക്ക് എയർപോർട്ടിലേക്ക് സെഡാൻ',
      'എന്റെ പ്രിയപ്പെട്ട ഡ്രൈവർ രാഹുലിനെ വിളിക്കുക'
    ],
    en: [
      'Book an auto to Lulu Mall',
      'Schedule a sedan to Cochin Airport tomorrow at 6 AM',
      'Book a bike to Central Railway Station'
    ],
    hi: [
      'मुझे एयरपोर्ट के लिए एक ऑटो चाहिए',
      'कल सुबह 7 बजे के लिए सेडान बुक करो',
      'रेलवे स्टेशन के लिए बाइक बुक करें'
    ],
    ta: [
      'எனக்கு லூலூ மாலுக்கு ஒரு ஆட்டோ வேண்டும்',
      'விமான நிலையத்திற்கு செடான் கார் புக் செய்'
    ],
    kn: [
      'ನನಗೆ ಮಾಲ್‌ಗೆ ಆಟೋ ಬೇಕು',
      'ವಿಮಾನ ನಿಲ್ದಾಣಕ್ಕೆ ಕಾರು ಬುಕ್ ಮಾಡಿ'
    ],
    te: [
      'నాకు ఎయిర్‌పోర్ట్‌కి ఆటో కావాలి',
      'రేపు ఉదయం 7 గంటలకు సెడాన్ బుక్ చేయండి'
    ]
  };

  useEffect(() => {
    if (!isOpen) {
      setTranscript('');
      setParsedResult(null);
      setIsListening(false);
    }
  }, [isOpen]);

  // Handle Speech Recognition
  const handleStartListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // If Web Speech API not supported in browser, provide helpful simulated voice prompt
      const fallbackPrompt = samplePrompts[language]?.[0] || samplePrompts.en[0];
      handleProcessUtterance(fallbackPrompt);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      const langCodeMap: Record<LanguageCode, string> = {
        ml: 'ml-IN',
        en: 'en-IN',
        hi: 'hi-IN',
        ta: 'ta-IN',
        kn: 'kn-IN',
        te: 'te-IN'
      };

      recognition.lang = langCodeMap[language] || 'en-IN';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript('');
        setParsedResult(null);
      };

      recognition.onresult = (event: any) => {
        const text = Array.from(event.results)
          .map((res: any) => res[0].transcript)
          .join('');
        setTranscript(text);
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition event:', e.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (transcript.trim().length > 0) {
          handleProcessUtterance(transcript);
        }
      };

      recognition.start();
    } catch (err) {
      console.warn('Recognition start error:', err);
      setIsListening(false);
    }
  };

  const handleProcessUtterance = async (text: string) => {
    setTranscript(text);
    setIsProcessing(true);
    try {
      const res = await api.parseVoiceIntent(text, currentLat, currentLng, language);
      setParsedResult(res.parsed);

      // Play audio spoken feedback prompt if available
      if (res.parsed?.preview?.spokenPrompt && 'speechSynthesis' in window) {
        try {
          const utterance = new SpeechSynthesisUtterance(res.parsed.preview.spokenPrompt);
          utterance.rate = 0.95;
          utterance.onstart = () => setAudioFeedbackPlaying(true);
          utterance.onend = () => setAudioFeedbackPlaying(false);
          window.speechSynthesis.speak(utterance);
        } catch {}
      }
    } catch (err) {
      console.error('Voice parsing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-500 to-emerald-400 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Aditi Voice Assistant</h3>
              <p className="text-xs text-slate-500">Natural voice booking in 6 languages</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 flex flex-col items-center text-center">
          
          {/* Waveform / Pulse Mic Button */}
          <div className="relative my-4 flex items-center justify-center">
            {isListening && (
              <>
                <span className="animate-ping absolute inline-flex h-32 w-32 rounded-full bg-brand-400 opacity-40"></span>
                <span className="animate-pulse-slow absolute inline-flex h-24 w-24 rounded-full bg-emerald-500 opacity-30"></span>
              </>
            )}
            <button
              onClick={isListening ? () => setIsListening(false) : handleStartListening}
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition-all ${
                isListening
                  ? 'bg-rose-500 hover:bg-rose-600 scale-110 shadow-rose-500/40'
                  : 'bg-gradient-to-tr from-brand-600 to-emerald-500 hover:scale-105 shadow-brand-500/30 ring-4 ring-brand-100 dark:ring-brand-950'
              }`}
            >
              {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>
          </div>

          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {isListening
              ? '🎙️ Listening... speak naturally now'
              : isProcessing
              ? '⚡ Understanding your journey request...'
              : 'Tap microphone and tell where you want to go'}
          </p>

          {/* Transcript Display */}
          {transcript && (
            <div className="w-full mt-4 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-left">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Understood Speech</p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 italic">"{transcript}"</p>
            </div>
          )}

          {/* Parsed Booking Preview Sheet */}
          {parsedResult && parsedResult.preview && (
            <div className="w-full mt-4 p-4 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 text-left animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-emerald-200/60 dark:border-emerald-800/60">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center space-x-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Trip Preview Ready</span>
                </span>
                <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                  ₹{parsedResult.preview.estimatedFare}
                </span>
              </div>

              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center space-x-2">
                  <Navigation className="w-3.5 h-3.5 text-brand-600" />
                  <span className="font-semibold text-slate-900 dark:text-white truncate">
                    {parsedResult.entities.destination}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Car className="w-3.5 h-3.5 text-brand-600" />
                    <span>{parsedResult.entities.vehicleCategoryName || 'Aditi Auto'}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>{parsedResult.preview.durationMin} mins • {parsedResult.preview.distanceKm} km</span>
                  </div>
                </div>

                {parsedResult.entities.isScheduled && (
                  <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                    📅 Scheduled for: {new Date(parsedResult.entities.scheduledAt).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Spoken prompt caption */}
              <div className="mt-3 p-2.5 bg-white/70 dark:bg-slate-900/60 rounded-xl text-[11px] text-slate-600 dark:text-slate-400 flex items-start space-x-2">
                <Volume2 className={`w-4 h-4 text-brand-600 shrink-0 ${audioFeedbackPlaying ? 'animate-bounce' : ''}`} />
                <span>{parsedResult.preview.spokenPrompt}</span>
              </div>

              {/* Confirm Action */}
              <button
                onClick={() => {
                  onConfirmBooking(parsedResult);
                  onClose();
                }}
                className="w-full mt-4 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-sm shadow-md shadow-brand-500/20 transition-all flex items-center justify-center space-x-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Confirm & Book (₹{parsedResult.preview.estimatedFare})</span>
              </button>
            </div>
          )}

          {/* Quick Clickable Suggestions */}
          {!parsedResult && (
            <div className="w-full mt-5 text-left">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Or tap a sample voice prompt:
              </p>
              <div className="space-y-1.5">
                {(samplePrompts[language] || samplePrompts.en).map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleProcessUtterance(prompt)}
                    className="w-full text-left px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/40 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-medium border border-slate-200/70 dark:border-slate-700/70 transition-colors truncate"
                  >
                    💬 "{prompt}"
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
