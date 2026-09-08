import React, { useState } from 'react';
import { Volume2, VolumeX, Sparkles, CheckCircle, HelpCircle, ChevronDown, ChevronUp, Languages } from 'lucide-react';
import { ChatMessage as ChatMessageType, CompanionProfile } from '../types';

interface ChatMessageProps {
  message: ChatMessageType;
  companion: CompanionProfile;
  isCurrentlyPlaying: boolean;
  onPlayAudio: (text: string, overrideGender?: CompanionProfile['voiceGender'], msgId?: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  companion,
  isCurrentlyPlaying,
  onPlayAudio,
}) => {
  const isCompanion = message.sender === 'companion';
  const [showArabic, setShowArabic] = useState<boolean>(false);
  const [showSlangDetail, setShowSlangDetail] = useState<boolean>(true);

  return (
    <div
      className={`flex flex-col gap-2 w-full my-3 ${
        isCompanion ? 'items-start' : 'items-end'
      }`}
    >
      <div className={`flex items-end gap-2.5 max-w-[92%] sm:max-w-[82%] ${isCompanion ? 'flex-row' : 'flex-row-reverse'}`}>
        
        {/* Avatar */}
        {isCompanion && (
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-lg shrink-0 mb-1">
            {companion.avatar}
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={`rounded-2xl px-4 py-3.5 shadow-md text-sm sm:text-base leading-relaxed ${
            isCompanion
              ? 'bg-slate-800/95 border border-slate-700/80 text-slate-100 rounded-bl-sm'
              : 'bg-amber-500 text-slate-950 font-medium rounded-br-sm'
          }`}
        >
          {/* German Text */}
          <div className="flex items-start justify-between gap-3">
            <p className="tracking-normal whitespace-pre-wrap select-text font-sans" dir="ltr">
              {message.text}
            </p>

            {/* Play Audio Button for Companion */}
            {isCompanion && (
              <button
                type="button"
                onClick={() => onPlayAudio(message.text, undefined, message.id)}
                title={isCurrentlyPlaying ? 'إيقاف الصوت' : 'استمع للنطق الألماني'}
                className={`p-1.5 rounded-lg transition-colors shrink-0 cursor-pointer ${
                  isCurrentlyPlaying
                    ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400'
                    : 'bg-slate-700/70 hover:bg-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {isCurrentlyPlaying ? (
                  <VolumeX className="w-4 h-4 animate-pulse" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
            )}
          </div>

          {/* Optional Arabic Translation Toggle */}
          {isCompanion && message.arabicTranslation && (
            <div className="mt-2.5 pt-2 border-t border-slate-700/50">
              {showArabic ? (
                <div className="text-xs sm:text-sm text-slate-300 font-normal bg-slate-900/50 p-2.5 rounded-xl border border-slate-700/40 animate-fadeIn" dir="rtl">
                  <div className="flex items-center justify-between gap-2 text-slate-400 text-[11px] mb-1">
                    <span className="flex items-center gap-1 font-semibold text-amber-400/90">
                      <Languages className="w-3.5 h-3.5" />
                      الترجمة العربية:
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowArabic(false)}
                      className="text-slate-400 hover:text-slate-200 text-[11px] underline cursor-pointer"
                    >
                      إخفاء
                    </button>
                  </div>
                  <p>{message.arabicTranslation}</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowArabic(true)}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                  dir="rtl"
                >
                  <Languages className="w-3.5 h-3.5" />
                  <span>إظهار الترجمة بالعربية</span>
                </button>
              )}
            </div>
          )}

          {/* Timestamp */}
          <div
            className={`text-[10px] mt-1 text-right ${
              isCompanion ? 'text-slate-500' : 'text-slate-800'
            }`}
          >
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

      </div>

      {/* Grammar Correction Card (if user made a mistake and companion gently guides them) */}
      {message.grammarCorrection && (
        <div className="w-[92%] sm:w-[82%] mr-auto ml-2 bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3 text-xs sm:text-sm shadow-sm" dir="rtl">
          <div className="flex items-center gap-1.5 font-bold text-emerald-400 mb-1.5">
            <CheckCircle className="w-4 h-4" />
            <span>نصيحة نحوية ولغوية من {companion.name}:</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">كيف قلتها:</span>
              <span className="text-rose-400 line-through font-mono" dir="ltr">{message.grammarCorrection.original}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">كيف يقولها الألمان بالعامية:</span>
              <span className="text-emerald-300 font-semibold font-mono" dir="ltr">{message.grammarCorrection.corrected}</span>
            </div>
          </div>

          <p className="text-slate-300 text-xs leading-relaxed">
            💡 {message.grammarCorrection.explanationAr}
          </p>
        </div>
      )}

      {/* Slang Tips Card (Umgangssprache vs Hochdeutsch) */}
      {isCompanion && message.slangTips && message.slangTips.length > 0 && (
        <div className="w-[92%] sm:w-[82%] ml-auto mr-2 bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 text-xs sm:text-sm shadow-sm" dir="rtl">
          
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>تعابير عامية وردت في الجملة (Umgangssprache):</span>
            </div>
            <button
              type="button"
              onClick={() => setShowSlangDetail(!showSlangDetail)}
              className="text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              {showSlangDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {showSlangDetail && (
            <div className="space-y-2.5 pt-1">
              {message.slangTips.map((tip, idx) => (
                <div key={idx} className="bg-slate-900/80 rounded-lg p-2.5 border border-slate-700/60">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <span className="font-bold text-amber-400 text-sm font-mono tracking-wide" dir="ltr">
                      "{tip.term}"
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      رسمي (Hochdeutsch): <strong className="text-slate-200 font-mono" dir="ltr">{tip.formalGerman}</strong>
                    </span>
                  </div>

                  <p className="text-slate-300 text-xs mb-1.5">
                    {tip.explanationAr}
                  </p>

                  <div className="bg-slate-950/60 px-2 py-1 rounded text-slate-400 text-[11px] flex items-center justify-between" dir="ltr">
                    <span className="italic font-mono">Bsp: {tip.example}</span>
                    <button
                      type="button"
                      onClick={() => onPlayAudio(tip.example)}
                      title="استمع للمثال"
                      className="text-amber-400 hover:text-amber-300 ml-2"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

    </div>
  );
};
