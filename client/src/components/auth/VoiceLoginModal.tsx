import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api.js';
import { User, LanguageCode } from '../../types/index.js';
import {
  Mic,
  MicOff,
  Volume2,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Car,
  UserCheck,
  Truck,
  Shield,
  Radio,
  ArrowRight
} from 'lucide-react';

interface VoiceLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User, token: string) => void;
  defaultLanguage?: LanguageCode;
  selectedRole?: string;
}

export const VoiceLoginModal: React.FC<VoiceLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  defaultLanguage = 'ml',
  selectedRole = 'PASSENGER'
}) => {
  const [activeLang, setActiveLang] = useState<LanguageCode>(defaultLanguage);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [manualText, setManualText] = useState('');
  const recognitionRef = useRef<any>(null);

  // Sample prompt chips tailored for natural regional speech login
  const sampleVoicePrompts: Record<LanguageCode, { text: string; label: string; role: string }[]> = {
    ml: [
      { text: 'ഞാൻ ധന്യ മേനോൻ', label: 'ധന്യ മേനോൻ (Passenger)', role: 'PASSENGER' },
      { text: 'ഡ്രൈവർ രാഹുൽ നായർ', label: 'രാഹുൽ നായർ (Captain)', role: 'DRIVER' },
      { text: 'അരുൺ കുമാർ ഡ്രൈവർ', label: 'അരുൺ കുമാർ (Captain)', role: 'DRIVER' },
      { text: 'കേരള സ്റ്റാർ ഫ്ലീറ്റ്', label: 'Kerala Star Fleet (Fleet)', role: 'FLEET_MANAGER' }
    ],
    en: [
      { text: 'I am Dhanya Menon', label: 'Dhanya Menon (Passenger)', role: 'PASSENGER' },
      { text: 'Login as Rahul Nair', label: 'Rahul Nair (Captain)', role: 'DRIVER' },
      { text: 'Arun Kumar captain', label: 'Arun Kumar (Captain)', role: 'DRIVER' },
      { text: 'Kerala Star Mobility Fleet', label: 'Fleet Manager', role: 'FLEET_MANAGER' }
    ],
    hi: [
      { text: 'मेरा नाम सुरेश बाबू है', label: 'सुरेश बाबू (Captain)', role: 'DRIVER' },
      { text: 'धन्या मेनन लॉगिन करो', label: 'Dhanya Menon (Passenger)', role: 'PASSENGER' }
    ],
    ta: [
      { text: 'நான் பிரியா', label: 'பிரியா (Captain)', role: 'DRIVER' },
      { text: 'ராகுல் நாயர்', label: 'ராகுல் நாயர் (Captain)', role: 'DRIVER' }
    ],
    kn: [
      { text: 'ನಾನು ಧನ್ಯ ಮೆನನ್', label: 'ಧನ್ಯ ಮೆನನ್ (Passenger)', role: 'PASSENGER' }
    ],
    te: [
      { text: 'నేను ధన్య మీనన్', label: 'ధన్య మీనన్ (Passenger)', role: 'PASSENGER' }
    ]
  };

  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setErrorMsg('');
      setIsProcessing(false);
      startListening();
    } else {
      stopListening();
    }
    return () => {
      stopListening();
    };
  }, [isOpen, activeLang]);

  const speakFeedback = (text: string, lang: LanguageCode) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const langMap: Record<LanguageCode, string> = {
          ml: 'ml-IN',
          en: 'en-IN',
          hi: 'hi-IN',
          ta: 'ta-IN',
          kn: 'kn-IN',
          te: 'te-IN'
        };
        utterance.lang = langMap[lang] || 'en-IN';
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis feedback warning:', e);
      }
    }
  };

  const handleProcessVoiceLogin = async (voiceUtterance: string) => {
    if (!voiceUtterance.trim()) return;

    setIsProcessing(true);
    setErrorMsg('');
    setTranscript(voiceUtterance);

    try {
      const res = await api.voiceLogin(
        voiceUtterance.trim(),
        activeLang,
        selectedRole === 'FLEET' ? 'FLEET_MANAGER' : selectedRole
      );

      if (res.speechFeedback) {
        speakFeedback(res.speechFeedback, activeLang);
      }

      setTimeout(() => {
        onLoginSuccess(res.user, res.token);
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'Voice login could not find a matching account.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg('Web Speech API is not supported in this browser. You can tap a voice preset below.');
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      const langCodeMap: Record<LanguageCode, string> = {
        ml: 'ml-IN',
        en: 'en-IN',
        hi: 'hi-IN',
        ta: 'ta-IN',
        kn: 'kn-IN',
        te: 'te-IN'
      };

      recognition.lang = langCodeMap[activeLang] || 'ml-IN';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMsg('');
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);

        if (event.results[0].isFinal) {
          setIsListening(false);
          handleProcessVoiceLogin(currentTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setErrorMsg('Microphone access was denied. Please allow microphone permissions or tap a preset.');
        } else if (event.error !== 'no-speech') {
          setErrorMsg(`Voice error: ${event.error}. You can tap any sample voice preset.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Could not initialize speech recognition:', err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/90 rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl shadow-black/90 space-y-6 text-slate-100 relative overflow-hidden">
        
        {/* Glowing Background Ambient Circles */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 relative">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/40">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-extrabold text-white">Voice Authentication</h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                  AI Voice
                </span>
              </div>
              <p className="text-xs text-slate-400">Speak your name, email, or role to sign in instantly</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Language Selection Pills */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            Voice Speech Language
          </label>
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveLang('ml')}
              className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeLang === 'ml' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              മലയാളം (ML)
            </button>
            <button
              type="button"
              onClick={() => setActiveLang('en')}
              className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeLang === 'en' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              English (EN)
            </button>
            <button
              type="button"
              onClick={() => setActiveLang('hi')}
              className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeLang === 'hi' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              हिन्दी (HI)
            </button>
            <button
              type="button"
              onClick={() => setActiveLang('ta')}
              className={`py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeLang === 'ta' ? 'bg-amber-500 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              தமிழ் (TA)
            </button>
          </div>
        </div>

        {/* Central Animated Microphone & Visualizer */}
        <div className="flex flex-col items-center justify-center py-4 space-y-4 relative">
          
          {/* Animated Glowing Sound Rings */}
          <div className="relative flex items-center justify-center">
            {isListening && (
              <>
                <div className="absolute w-28 h-28 rounded-full bg-amber-500/20 animate-ping" />
                <div className="absolute w-36 h-36 rounded-full bg-emerald-500/15 animate-pulse" />
              </>
            )}

            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              disabled={isProcessing}
              className={`w-20 h-20 rounded-3xl flex items-center justify-center text-white shadow-2xl transition-all relative z-10 active:scale-95 ${
                isListening
                  ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-emerald-500 shadow-amber-500/40 ring-4 ring-amber-400/50 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-amber-500/50 shadow-black'
              }`}
            >
              {isProcessing ? (
                <div className="animate-spin w-8 h-8 border-3 border-white border-t-transparent rounded-full" />
              ) : isListening ? (
                <Mic className="w-9 h-9 animate-bounce" />
              ) : (
                <MicOff className="w-8 h-8 text-slate-400" />
              )}
            </button>
          </div>

          {/* Listening / Recognized Status */}
          <div className="text-center space-y-1 max-w-sm">
            <p className="text-xs font-bold text-slate-300">
              {isProcessing
                ? '🧠 Recognizing voice and verifying credentials...'
                : isListening
                ? '🎙️ Listening... Speak your name or "ഞാൻ [പേര്]"'
                : 'Tap the microphone above to start speaking'}
            </p>
            {transcript && (
              <div className="p-3 bg-slate-950/90 rounded-2xl border border-slate-800 text-xs font-semibold text-amber-300 animate-in fade-in">
                "{transcript}"
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="p-3 bg-rose-950/70 border border-rose-800 rounded-2xl text-xs font-semibold text-rose-300 animate-in fade-in flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Sample Voice Prompts (Instant Tap to Authenticate) */}
        <div className="space-y-2 pt-1 border-t border-slate-800">
          <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            <span>Quick Voice Presets (Tap to Test)</span>
            <span className="text-amber-400">1-Tap Voice Match</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(sampleVoicePrompts[activeLang] || sampleVoicePrompts.ml).map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleProcessVoiceLogin(p.text)}
                disabled={isProcessing}
                className="p-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 rounded-2xl flex flex-col text-left transition-all group disabled:opacity-50"
              >
                <span className="text-xs font-bold text-slate-200 group-hover:text-amber-300 truncate">
                  "{p.text}"
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 truncate">
                  {p.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Manual Speech Fallback */}
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualText.trim()) handleProcessVoiceLogin(manualText.trim());
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Or type spoken phrase e.g. ഞാൻ ധന്യ മേനോൻ"
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="submit"
              disabled={isProcessing || !manualText.trim()}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center space-x-1 disabled:opacity-50"
            >
              <span>Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
