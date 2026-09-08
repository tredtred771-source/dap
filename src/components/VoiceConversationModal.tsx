import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  RotateCcw,
  Sparkles,
  Pause,
  Play,
  Turtle,
  AlertCircle,
  HelpCircle,
  Headphones,
  CheckCircle2
} from 'lucide-react';
import { CompanionProfile, ChatMessage, VoiceConversationState } from '../types';
import { speechService } from '../services/speech';
import { sendMessageToCompanion, ChatResponse } from '../services/api';

interface VoiceConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  companion: CompanionProfile;
  messages: ChatMessage[];
  onNewMessagePair: (userMsg: ChatMessage, companionMsg: ChatMessage) => void;
}

export const VoiceConversationModal: React.FC<VoiceConversationModalProps> = ({
  isOpen,
  onClose,
  companion,
  messages,
  onNewMessagePair,
}) => {
  const [state, setState] = useState<VoiceConversationState>('idle');
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [companionReply, setCompanionReply] = useState<string>('');
  const [companionTranslation, setCompanionTranslation] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioVolume, setAudioVolume] = useState<number>(0);
  const [isSlowMode, setIsSlowMode] = useState<boolean>(false);
  const [historyContext, setHistoryContext] = useState<ChatMessage[]>(messages);

  // Keep ref for fresh state access in async loops
  const stateRef = useRef<VoiceConversationState>(state);
  stateRef.current = state;

  const isOpenRef = useRef<boolean>(isOpen);
  isOpenRef.current = isOpen;

  const lastCompanionTextRef = useRef<string>('');
  const historyRef = useRef<ChatMessage[]>(messages);
  historyRef.current = historyContext;

  // Initialize or reset when opened
  useEffect(() => {
    if (isOpen) {
      setHistoryContext(messages);
      setErrorMessage(null);
      setUserTranscript('');

      // Find the last companion message for reference
      const lastMsg = [...messages].reverse().find((m) => m.sender === 'companion');
      if (lastMsg) {
        setCompanionReply(lastMsg.text);
        setCompanionTranslation(lastMsg.arabicTranslation || '');
        lastCompanionTextRef.current = lastMsg.text;
      } else {
        const welcomeText = `Hallo ${companion.userName}! Schön, dass wir sprechen können. Wie geht es dir heute?`;
        setCompanionReply(welcomeText);
        setCompanionTranslation(`أهلاً ${companion.userName}! رائع أننا نستطيع التحدث. كيف حالك اليوم؟`);
        lastCompanionTextRef.current = welcomeText;
      }

      // Start by speaking welcome or starting to listen
      startWelcomeTurn();
    } else {
      // Teardown when closed
      teardownVoiceSession();
    }

    return () => {
      teardownVoiceSession();
    };
  }, [isOpen]);

  const teardownVoiceSession = () => {
    speechService.stopSpeaking();
    speechService.stopVoiceModeListening();
    setState('idle');
  };

  /**
   * Welcome Turn when opening Voice Mode
   */
  const startWelcomeTurn = () => {
    const greeting = lastCompanionTextRef.current || `Hallo ${companion.userName}, wie läuft dein Tag?`;
    
    // Play greeting, then start continuous listening loop
    setState('speaking');
    speechService.speakText(
      greeting,
      companion.voiceGender,
      () => {
        if (isOpenRef.current) setState('speaking');
      },
      () => {
        if (isOpenRef.current && stateRef.current !== 'paused') {
          // 400ms cooldown for speaker echo decay before microphone activates
          setTimeout(() => {
            if (isOpenRef.current && stateRef.current !== 'paused') {
              startListeningLoop();
            }
          }, 400);
        }
      },
      (err) => {
        console.warn('Welcome TTS error:', err);
        if (isOpenRef.current) {
          startListeningLoop();
        }
      },
      { rate: isSlowMode ? 0.78 : 0.98 }
    );
  };

  /**
   * Main Listening Step in the Loop
   */
  const startListeningLoop = () => {
    if (!isOpenRef.current || stateRef.current === 'paused') return;

    // Strict echo prevention: Ensure all audio output has stopped before mic starts
    speechService.stopSpeaking();
    setState('listening');
    setUserTranscript('');
    setErrorMessage(null);

    speechService.startVoiceModeListening({
      onInterim: (interimText) => {
        if (stateRef.current === 'listening') {
          setUserTranscript(interimText);
        }
      },
      onSpeechFinal: (finalText) => {
        if (!isOpenRef.current || stateRef.current === 'paused') return;
        handleUserSpokenText(finalText);
      },
      onError: (errMsg) => {
        console.warn('Voice listening error:', errMsg);
        if (isOpenRef.current) {
          setState('error');
          setErrorMessage(errMsg);
        }
      },
      onVolumeChange: (vol) => {
        setAudioVolume(vol);
      },
    });
  };

  /**
   * Process and understand user utterance
   */
  const handleUserSpokenText = async (rawText: string) => {
    const text = rawText.trim();

    // 1. Noise / Empty speech check
    if (!text || text.length < 2) {
      console.log('Voice mode: Ignore empty utterance or pure noise');
      if (isOpenRef.current && stateRef.current !== 'paused') {
        startListeningLoop();
      }
      return;
    }

    // Stop listening immediately to prevent echo
    speechService.stopVoiceModeListening();
    setUserTranscript(text);

    // 2. Local Voice Command: Slower speech ("Langsamer bitte")
    const lower = text.toLowerCase();
    if (
      lower.includes('langsamer') ||
      lower.includes('bitte langsamer') ||
      lower.includes('sprich langsamer') ||
      lower.includes('ببطء')
    ) {
      setIsSlowMode(true);
      speechService.setSpeechRate(0.78);
      const ackReply = 'Klar, kein Ding! Ich spreche ab jetzt etwas langsamer für dich.';
      const ackAr = 'بالتأكيد، لا مشكلة! سأتحدث ببطء أكثر من أجلك من الآن.';
      setCompanionReply(ackReply);
      setCompanionTranslation(ackAr);
      lastCompanionTextRef.current = ackReply;
      playCompanionReply(ackReply);
      return;
    }

    // 3. Local Voice Command: Repeat ("Kannst du das wiederholen?")
    if (
      lower.includes('wiederholen') ||
      lower.includes('wiederhole') ||
      lower.includes('nochmal') ||
      lower.includes('noch einmal') ||
      lower.includes('كرر') ||
      lower.includes('عيد')
    ) {
      const textToRepeat = lastCompanionTextRef.current || companionReply;
      if (textToRepeat) {
        const repPrefix = 'Gerne! Ich wiederhole es nochmal: ';
        const fullRep = repPrefix + textToRepeat;
        setCompanionReply(fullRep);
        playCompanionReply(fullRep);
        return;
      }
    }

    // 4. Send user message to AI (Gemini) with full conversation context
    setState('processing');

    try {
      const userMsg: ChatMessage = {
        id: 'voice-user-' + Date.now(),
        sender: 'user',
        text,
        timestamp: Date.now(),
      };

      const response: ChatResponse = await sendMessageToCompanion(
        companion,
        text,
        historyRef.current
      );

      const companionMsg: ChatMessage = {
        id: 'voice-ai-' + Date.now(),
        sender: 'companion',
        text: response.reply,
        arabicTranslation: response.arabicTranslation,
        grammarCorrection: response.grammarCorrection,
        slangTips: response.slangTips,
        timestamp: Date.now(),
      };

      // Update history in modal and parent App
      const updatedHistory = [...historyRef.current, userMsg, companionMsg];
      setHistoryContext(updatedHistory);
      onNewMessagePair(userMsg, companionMsg);

      // Display response
      setCompanionReply(response.reply);
      setCompanionTranslation(response.arabicTranslation || '');
      lastCompanionTextRef.current = response.reply;

      // Speak response out loud
      playCompanionReply(response.reply);
    } catch (err: any) {
      console.error('Error in voice AI response:', err);
      // Fallback grace message: "Entschuldigung, das habe ich nicht ganz verstanden..."
      const fallbackReply = 'Entschuldigung, das habe ich nicht ganz verstanden. Kannst du das noch einmal sagen?';
      const fallbackAr = 'عذراً، لم أفهم ذلك جيداً. هل يمكنك قول ذلك مرة أخرى؟';
      setCompanionReply(fallbackReply);
      setCompanionTranslation(fallbackAr);
      lastCompanionTextRef.current = fallbackReply;
      playCompanionReply(fallbackReply);
    }
  };

  /**
   * Speak companion reply and resume loop upon completion
   */
  const playCompanionReply = (textToSpeak: string) => {
    if (!isOpenRef.current) return;

    // Strictly ensure microphone is closed during speech
    speechService.stopVoiceModeListening();
    setState('speaking');

    speechService.speakText(
      textToSpeak,
      companion.voiceGender,
      () => {
        if (isOpenRef.current) setState('speaking');
      },
      () => {
        // When speech finishes:
        if (isOpenRef.current && stateRef.current !== 'paused') {
          // Wait 400ms for room echo to decay
          setTimeout(() => {
            if (isOpenRef.current && stateRef.current !== 'paused') {
              startListeningLoop();
            }
          }, 400);
        }
      },
      (err) => {
        console.warn('TTS playback error:', err);
        if (isOpenRef.current && stateRef.current !== 'paused') {
          setTimeout(() => {
            startListeningLoop();
          }, 300);
        }
      },
      { rate: isSlowMode ? 0.78 : 0.98 }
    );
  };

  /**
   * Pause / Resume toggle
   */
  const handleTogglePause = () => {
    if (state === 'paused') {
      setState('listening');
      startListeningLoop();
    } else {
      speechService.stopSpeaking();
      speechService.stopVoiceModeListening();
      setState('paused');
    }
  };

  /**
   * Manual trigger to speak slower
   */
  const handleToggleSlowRate = () => {
    const nextSlow = !isSlowMode;
    setIsSlowMode(nextSlow);
    speechService.setSpeechRate(nextSlow ? 0.78 : 0.98);
    if (companionReply) {
      playCompanionReply(companionReply);
    }
  };

  /**
   * Repeat last reply
   */
  const handleRepeatLast = () => {
    if (lastCompanionTextRef.current) {
      playCompanionReply(lastCompanionTextRef.current);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-slate-950/95 backdrop-blur-xl text-slate-100 p-4 sm:p-6 overflow-hidden select-none"
      dir="rtl"
    >
      {/* Top Bar */}
      <div className="w-full max-w-2xl flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl shadow-inner">
            {companion.avatar}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-white">{companion.name}</h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>محادثة صوتية حية</span>
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {companion.voiceGender === 'female' ? 'صوت ألماني أنثوي' : 'صوت ألماني ذكوري'} • de-DE
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Slower rate toggle button */}
          <button
            type="button"
            onClick={handleToggleSlowRate}
            title={isSlowMode ? 'العودة للسرعة العادية' : 'تقليل سرعة النطق'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
              isSlowMode
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Turtle className="w-4 h-4" />
            <span>{isSlowMode ? 'نطق بطيء (0.8x)' : 'نطق عادي'}</span>
          </button>

          {/* Close / Stop Button */}
          <button
            type="button"
            id="close-voice-modal-btn"
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="إنهاء المحادثة الصوتية والعودة للشات"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Avatar & Animated Voice Visualizer */}
      <div className="flex-1 flex flex-col items-center justify-center my-4 w-full max-w-xl relative">
        {/* Visual Pulse Rings depending on state */}
        <div className="relative flex items-center justify-center my-4">
          {/* Speaking Rings */}
          {state === 'speaking' && (
            <>
              <div className="absolute w-44 h-44 rounded-full bg-amber-500/10 animate-ping opacity-60"></div>
              <div className="absolute w-56 h-56 rounded-full border border-amber-500/20 animate-pulse"></div>
            </>
          )}

          {/* Listening Rings */}
          {state === 'listening' && (
            <>
              <div className="absolute w-44 h-44 rounded-full bg-emerald-500/10 animate-pulse opacity-75"></div>
              <div
                className="absolute rounded-full border border-emerald-500/30 transition-all duration-150"
                style={{
                  width: `${160 + audioVolume * 0.8}px`,
                  height: `${160 + audioVolume * 0.8}px`,
                }}
              ></div>
            </>
          )}

          {/* Processing Rings */}
          {state === 'processing' && (
            <div className="absolute w-48 h-48 rounded-full border-2 border-dashed border-amber-400/40 animate-spin"></div>
          )}

          {/* Central Avatar */}
          <div
            className={`w-32 h-32 sm:w-36 sm:h-36 rounded-full flex items-center justify-center text-6xl sm:text-7xl shadow-2xl transition-all duration-300 z-10 ${
              state === 'speaking'
                ? 'bg-amber-500/20 border-4 border-amber-400 shadow-amber-500/30 scale-105'
                : state === 'listening'
                ? 'bg-emerald-500/20 border-4 border-emerald-400 shadow-emerald-500/30 scale-100'
                : state === 'processing'
                ? 'bg-amber-500/15 border-4 border-amber-500/50 shadow-amber-500/20'
                : 'bg-slate-800 border-4 border-slate-700'
            }`}
          >
            {companion.avatar}
          </div>
        </div>

        {/* State Badge with clear readable label */}
        <div className="mt-2 mb-4">
          {state === 'listening' && (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-semibold animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span>أستمع إليك الآن... تحدث بالألمانية 🎙️</span>
            </div>
          )}

          {state === 'processing' && (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-sm font-semibold">
              <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
              <span>{companion.name} يفهم كلامك ويفكر في الرد...</span>
            </div>
          )}

          {state === 'speaking' && (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-200 text-sm font-semibold">
              <Volume2 className="w-4 h-4 animate-bounce text-amber-400" />
              <span>{companion.name} يتحدث إليك الآن 🔊</span>
            </div>
          )}

          {state === 'paused' && (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-sm font-semibold">
              <Pause className="w-4 h-4 text-amber-400" />
              <span>المحادثة متوقفة مؤقتاً ⏸️</span>
            </div>
          )}

          {state === 'error' && (
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>{errorMessage || 'حدث خطأ في الصوت'}</span>
            </div>
          )}
        </div>

        {/* Live Conversation Display (Card) */}
        <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl text-right max-h-52 overflow-y-auto">
          {/* User's spoken text */}
          <div className="mb-3">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1 font-medium">
              <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              <span>كلامك أنت:</span>
            </div>
            <p
              className={`text-sm sm:text-base ${
                userTranscript ? 'text-emerald-300 font-medium' : 'text-slate-500 italic'
              }`}
              dir="ltr"
            >
              {userTranscript || (state === 'listening' ? 'تحدث الآن... (مثال: Hallo Lukas, wie geht es dir?)' : '—')}
            </p>
          </div>

          <div className="border-t border-slate-800/80 pt-3">
            <div className="text-[11px] text-amber-400/90 flex items-center gap-1.5 mb-1 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>رد {companion.name} (بالألمانية):</span>
            </div>
            <p className="text-base sm:text-lg font-semibold text-white tracking-wide" dir="ltr">
              {companionReply || '...'}
            </p>
            {companionTranslation && (
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed" dir="rtl">
                {companionTranslation}
              </p>
            )}
          </div>
        </div>

        {/* Helpful speech tips */}
        <div className="mt-3 text-center">
          <p className="text-[11px] text-slate-400">
            💡 نصيحة: يمكنك قول <span className="text-amber-300 font-semibold" dir="ltr">"Langsamer bitte"</span> لإبطاء السرعة، أو <span className="text-amber-300 font-semibold" dir="ltr">"Wiederholen bitte"</span> لإعادة الجملة!
          </p>
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="w-full max-w-md flex flex-col items-center gap-3 z-10">
        <div className="flex items-center justify-center gap-3 w-full">
          {/* Repeat button */}
          <button
            type="button"
            onClick={handleRepeatLast}
            disabled={!lastCompanionTextRef.current}
            title="إعادة نطق آخر جملة"
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-medium text-xs sm:text-sm transition-all cursor-pointer disabled:opacity-40"
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
            <span>إعادة الرد 🔁</span>
          </button>

          {/* Pause / Resume Button */}
          <button
            type="button"
            onClick={handleTogglePause}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm border transition-all cursor-pointer shadow-lg ${
              state === 'paused'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400 shadow-emerald-500/20'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'
            }`}
          >
            {state === 'paused' ? (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>متابعة المحادثة</span>
              </>
            ) : (
              <>
                <Pause className="w-4 h-4" />
                <span>إيقاف مؤقت</span>
              </>
            )}
          </button>
        </div>

        {/* Primary Stop and Finish Voice Button */}
        <button
          type="button"
          id="stop-voice-mode-btn"
          onClick={onClose}
          className="w-full py-3.5 px-6 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-sm border border-rose-500 shadow-lg shadow-rose-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
        >
          <X className="w-4 h-4" />
          <span>إنهاء المحادثة الصوتية والرجوع للنص</span>
        </button>
      </div>
    </div>
  );
};
