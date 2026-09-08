import React, { useState, useEffect, useRef } from 'react';
import { CompanionProfile, ChatMessage as ChatMessageType, SlangTip, DailyUsage } from './types';
import { CompanionSetup } from './components/CompanionSetup';
import { Header } from './components/Header';
import { ChatMessage } from './components/ChatMessage';
import { InputBar } from './components/InputBar';
import { QuickPrompts } from './components/QuickPrompts';
import { SlangVocabularyModal } from './components/SlangVocabularyModal';
import { VoiceConversationModal } from './components/VoiceConversationModal';
import {
  sendMessageToCompanion,
  saveConversationLocally,
  loadConversationLocally,
  clearConversationLocally,
  getDailyUsage,
  DAILY_FREE_LIMIT,
} from './services/api';
import { speechService } from './services/speech';
import { Loader2, AlertCircle, Sparkles, RotateCcw } from 'lucide-react';

const STORAGE_KEY_PROFILE = 'deutsch_buddy_profile';
const USER_ID = 'local_user_default';

export default function App() {
  const [companion, setCompanion] = useState<CompanionProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [learnedSlang, setLearnedSlang] = useState<SlangTip[]>([]);
  const [isSettingUp, setIsSettingUp] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [autoPlayAudio, setAutoPlayAudio] = useState<boolean>(false);
  const [isVocabModalOpen, setIsVocabModalOpen] = useState<boolean>(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [systemAlert, setSystemAlert] = useState<string | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage>(getDailyUsage());
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load profile and conversation locally on mount
  useEffect(() => {
    const initApp = () => {
      // 1. Load companion profile
      const savedProfile = localStorage.getItem(STORAGE_KEY_PROFILE);
      let loadedProfile: CompanionProfile | null = null;

      if (savedProfile) {
        try {
          loadedProfile = JSON.parse(savedProfile);
        } catch (e) {}
      }

      // 2. Load local conversation history
      const savedData = loadConversationLocally();
      let initialMessages: ChatMessageType[] = [];
      let initialSlang: SlangTip[] = [];

      if (savedData) {
        if (!loadedProfile && savedData.companion) {
          loadedProfile = savedData.companion;
        }
        initialMessages = savedData.messages || [];
        initialSlang = savedData.learnedSlang || [];
      }

      // 3. Update current daily usage state
      setDailyUsage(getDailyUsage());

      if (loadedProfile) {
        setCompanion(loadedProfile);
        setMessages(initialMessages);
        setLearnedSlang(initialSlang);

        // If no messages exist yet, trigger initial greeting
        if (initialMessages.length === 0) {
          triggerInitialGreeting(loadedProfile);
        }
      } else {
        // First time user: show setup screen
        setIsSettingUp(true);
      }
    };

    initApp();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Trigger initial natural German greeting
  const triggerInitialGreeting = (profile: CompanionProfile) => {
    const greetingText = `Moin ${profile.userName || 'du'}! Na, wie geht's dir heute? Schön, dass du da bist! Lass uns ein bisschen quatschen. Worüber hast du Bock zu sprechen?`;
    const arabicTranslation = `أهلاً ${profile.userName || 'يا صديقي'}! كيف حالك اليوم؟ من الرائع وجودك هنا! هيا ندردش قليلاً. عن ماذا ترغب أن نتحدث اليوم؟`;

    const initialSlangTips: SlangTip[] = [
      {
        term: 'Moin!',
        explanationAr: 'تحية عامية شمالية شهيرة جداً في كل ألمانيا تعني مرحباً أو صباح الخير وتصلح في أي وقت من اليوم!',
        formalGerman: 'Hallo / Guten Tag',
        example: "Moin moin, wie läuft's?",
      },
      {
        term: 'Bock haben',
        explanationAr: 'تعبير عامي شائع جداً يعني: عندك مزاج أو رغبة لعمل شيء.',
        formalGerman: 'Lust haben',
        example: 'Hast du Bock auf einen Kaffee?',
      },
      {
        term: 'quatschen',
        explanationAr: 'فعل عامي يعني الدردشة أو تبادل السوالف بصورة ودية وعفوية.',
        formalGerman: 'sich unterhalten / plaudern',
        example: 'Lass uns mal in Ruhe quatschen.',
      },
    ];

    const greetingMsg: ChatMessageType = {
      id: 'msg-greeting-' + Date.now(),
      sender: 'companion',
      text: greetingText,
      arabicTranslation,
      timestamp: Date.now(),
      slangTips: initialSlangTips,
    };

    const newMsgs = [greetingMsg];
    setMessages(newMsgs);
    setLearnedSlang(initialSlangTips);

    // Save locally
    saveConversationLocally({
      userId: USER_ID,
      companion: profile,
      messages: newMsgs,
      learnedSlang: initialSlangTips,
      lastUpdated: Date.now(),
    });

    // Speak natural greeting via Web Speech API
    if (autoPlayAudio) {
      handlePlayAudio(greetingText, profile.voiceGender, greetingMsg.id);
    }
  };

  const handleCompanionSetupComplete = (newProfile: CompanionProfile) => {
    setCompanion(newProfile);
    setIsSettingUp(false);
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(newProfile));

    // Clear old conversation and start fresh
    triggerInitialGreeting(newProfile);
  };

  const handleClearHistory = () => {
    if (!companion) return;
    speechService.stopSpeaking();
    setIsSpeaking(false);
    setPlayingMessageId(null);
    clearConversationLocally();
    triggerInitialGreeting(companion);
  };

  const handleNewVoiceMessagePair = (
    userMsg: ChatMessageType,
    companionMsg: ChatMessageType
  ) => {
    setMessages((prev) => {
      const updated = [...prev, userMsg, companionMsg];

      // Collect new slang tips
      let updatedSlang = [...learnedSlang];
      if (companionMsg.slangTips && companionMsg.slangTips.length > 0) {
        for (const tip of companionMsg.slangTips) {
          if (!updatedSlang.some((s) => s.term.toLowerCase() === tip.term.toLowerCase())) {
            updatedSlang.push(tip);
          }
        }
        setLearnedSlang(updatedSlang);
      }

      if (companion) {
        saveConversationLocally({
          userId: USER_ID,
          companion,
          messages: updated,
          learnedSlang: updatedSlang,
          lastUpdated: Date.now(),
        });
      }

      return updated;
    });

    setDailyUsage(getDailyUsage());
  };

  const handlePlayAudio = (
    text: string,
    overrideGender?: CompanionProfile['voiceGender'],
    msgId?: string
  ) => {
    // If clicking on the currently playing message, toggle stop immediately
    if (msgId && playingMessageId === msgId && isSpeaking) {
      speechService.stopSpeaking();
      setIsSpeaking(false);
      setPlayingMessageId(null);
      return;
    }

    // Stop any existing speech or audio first to prevent overlapping sounds
    speechService.stopSpeaking();
    setIsSpeaking(false);
    if (msgId) setPlayingMessageId(msgId);

    const gender = overrideGender || companion?.voiceGender || 'female';

    speechService.speakText(
      text,
      gender,
      () => {
        setIsSpeaking(true);
        if (msgId) setPlayingMessageId(msgId);
      },
      () => {
        setIsSpeaking(false);
        setPlayingMessageId(null);
      },
      (errorMsg) => {
        setIsSpeaking(false);
        setPlayingMessageId(null);
        setSystemAlert(errorMsg);
      }
    );
  };

  const handleRetry = async () => {
    if (!lastFailedText || isLoading || isRetrying) return;
    setIsRetrying(true);
    try {
      await handleSendMessage(lastFailedText, true);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSendMessage = async (text: string, isRetry: boolean = false) => {
    const trimmed = text.trim();
    if (!companion || !trimmed) return;
    if (isLoading && !isRetry) return;

    // Check daily quota warning
    const currentUsage = getDailyUsage();
    if (currentUsage.count >= DAILY_FREE_LIMIT) {
      setSystemAlert(
        'وصلت إلى الحد اليومي المجاني (1,500 طلب/يوم). سيتجدد الرصيد تلقائياً غداً للاستخدام المجاني غير المحدود!'
      );
      return;
    }

    // Stop speaking previous message
    speechService.stopSpeaking();
    setIsSpeaking(false);
    setPlayingMessageId(null);

    let newMessages = messages;
    // When retrying, do not duplicate the user's message if it was already appended
    const lastMsg = messages[messages.length - 1];
    const isAlreadyPresent = lastMsg && lastMsg.sender === 'user' && lastMsg.text.trim() === trimmed;

    if (!isRetry || !isAlreadyPresent) {
      const userMsg: ChatMessageType = {
        id: 'msg-user-' + Date.now(),
        sender: 'user',
        text: trimmed,
        timestamp: Date.now(),
      };
      newMessages = [...messages, userMsg];
      setMessages(newMessages);
    }

    setIsLoading(true);

    try {
      const companionResponse = await sendMessageToCompanion(companion, trimmed, newMessages);

      const companionMsg: ChatMessageType = {
        id: 'msg-companion-' + Date.now(),
        sender: 'companion',
        text: companionResponse.reply,
        arabicTranslation: companionResponse.arabicTranslation,
        timestamp: Date.now(),
        grammarCorrection: companionResponse.grammarCorrection,
        slangTips: companionResponse.slangTips,
      };

      const finalMessages = [...newMessages, companionMsg];
      setMessages(finalMessages);

      // Successfully processed: reset retry and error state
      setLastFailedText(null);
      setSystemAlert(null);

      // Accumulate new slang words
      let updatedSlang = [...learnedSlang];
      if (companionResponse.slangTips && companionResponse.slangTips.length > 0) {
        for (const tip of companionResponse.slangTips) {
          if (!updatedSlang.some((s) => s.term.toLowerCase() === tip.term.toLowerCase())) {
            updatedSlang.push(tip);
          }
        }
        setLearnedSlang(updatedSlang);
      }

      // Persist 100% locally to localStorage
      saveConversationLocally({
        userId: USER_ID,
        companion,
        messages: finalMessages,
        learnedSlang: updatedSlang,
        lastUpdated: Date.now(),
      });

      // Update daily usage state
      const updatedUsage = getDailyUsage();
      setDailyUsage(updatedUsage);

      // Check if approaching 1,500 daily requests
      if (updatedUsage.count >= 1350) {
        setSystemAlert(
          `تنبيه رائع: لقد أجريت اليوم ${updatedUsage.count} محادثة! أنت تقترب من الحد اليومي المجاني (1,500 طلب). استمر في التعلم الرائع!`
        );
      }

      // Speak response via Web Speech API / HTML5 Audio
      if (autoPlayAudio) {
        handlePlayAudio(companionResponse.reply, companion.voiceGender, companionMsg.id);
      }
    } catch (err: any) {
      console.error('Error getting response:', err);
      setLastFailedText(trimmed);
      const rawMsg = err?.message || '';
      if (rawMsg.includes('503') || rawMsg.includes('high demand') || rawMsg.includes('UNAVAILABLE')) {
        setSystemAlert('النموذج يواجه ضغطاً مؤقتاً (503)، اضغط على "إعادة المحاولة" للمتابعة فوراً.');
      } else if (rawMsg.includes('429') || rawMsg.includes('quota') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
        setSystemAlert('لقد بلغت سرعة الطلبات الحد المسموح به مؤقتاً، يرجى الانتظار بضع ثوانٍ وإعادة المحاولة.');
      } else if (rawMsg.includes('404')) {
        setSystemAlert('نقطة النهاية غير موجودة على الخادم (404). يرجى التأكد من اتصال السيرفر.');
      } else {
        setSystemAlert(`حدث خطأ في الاتصال: ${rawMsg || 'اضغط على زر إعادة المحاولة.'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // If user is currently setting up the companion
  if (isSettingUp || !companion) {
    return (
      <CompanionSetup
        initialProfile={companion}
        onComplete={handleCompanionSetupComplete}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Top Header with Daily Usage Tracker */}
      <Header
        companion={companion}
        isSpeaking={isSpeaking}
        autoPlayAudio={autoPlayAudio}
        onToggleAutoPlay={() => {
          setAutoPlayAudio(!autoPlayAudio);
          if (isSpeaking) {
            speechService.stopSpeaking();
            setIsSpeaking(false);
          }
        }}
        onOpenVoiceMode={() => setIsVoiceModalOpen(true)}
        onOpenVocabulary={() => setIsVocabModalOpen(true)}
        onChangeCompanion={() => setIsSettingUp(true)}
        learnedSlangCount={learnedSlang.length}
        dailyUsage={dailyUsage}
        onClearHistory={handleClearHistory}
      />

      {/* Alert banner if needed */}
      {systemAlert && (
        <div
          className="bg-rose-950/90 border-b border-rose-800 text-rose-200 text-xs px-4 py-2.5 flex items-center justify-between gap-3 shadow-md"
          dir="rtl"
        >
          <div className="flex items-center gap-2 flex-1">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-medium">{systemAlert}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lastFailedText && (
              <button
                type="button"
                id="retry-failed-message-btn"
                onClick={handleRetry}
                disabled={isLoading || isRetrying}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري المحاولة...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>إعادة المحاولة</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setSystemAlert(null)}
              className="text-rose-400 font-bold hover:text-white px-1.5 py-1 cursor-pointer"
              title="إغلاق التنبيه"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Conversation Feed */}
      <main className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 max-w-4xl w-full mx-auto">
        <div className="flex flex-col min-h-full justify-end">
          {/* Welcome Info Box */}
          <div className="text-center py-4 mb-3 border-b border-slate-900" dir="rtl">
            <div className="inline-block p-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-2xl mb-1">
              {companion.avatar}
            </div>
            <h3 className="text-sm font-semibold text-slate-300">
              أنت الآن تتحدث مع {companion.name} ({companion.voiceGender === 'female' ? 'صوت بنت' : 'صوت شب'})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              تحدث بحرية، تدرب على العامية الألمانية وسيقوم {companion.name} بتصحيح أخطائك وتعليمك التعبيرات الدارجة فوراً.
            </p>
            <button
              type="button"
              id="hero-voice-call-btn"
              onClick={() => setIsVoiceModalOpen(true)}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
            >
              <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping"></span>
              <span>بدء محادثة صوتية مستمرة الآن (Voice Call) 🎙️</span>
            </button>
          </div>

          {/* Messages */}
          <div className="space-y-1">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                companion={companion}
                isCurrentlyPlaying={playingMessageId === msg.id && isSpeaking}
                onPlayAudio={(text) => handlePlayAudio(text, companion.voiceGender, msg.id)}
              />
            ))}
          </div>

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 py-3 px-4 text-slate-400 text-xs bg-slate-900/60 rounded-xl border border-slate-800/80 w-fit my-2">
              <span className="text-base">{companion.avatar}</span>
              <span className="italic" dir="ltr">
                {companion.name} schreibt...
              </span>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Bottom Action Area */}
      <footer className="bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-3 sm:p-4 z-20">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Quick Prompts Bar */}
          <QuickPrompts
            onSelectPrompt={(prompt) => handleSendMessage(prompt)}
            disabled={isLoading}
          />

          {/* Input Bar (Text + Speech-to-Text via Web Speech API) */}
          <InputBar
            onSendMessage={handleSendMessage}
            onOpenVoiceMode={() => setIsVoiceModalOpen(true)}
            disabled={isLoading}
          />
        </div>
      </footer>

      {/* Learned Slang Modal */}
      <SlangVocabularyModal
        isOpen={isVocabModalOpen}
        onClose={() => setIsVocabModalOpen(false)}
        learnedSlang={learnedSlang}
        onPlayAudio={(text) => handlePlayAudio(text, companion.voiceGender)}
      />

      {/* Live Continuous Voice Conversation Modal */}
      <VoiceConversationModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        companion={companion}
        messages={messages}
        onNewMessagePair={handleNewVoiceMessagePair}
      />
    </div>
  );
}
