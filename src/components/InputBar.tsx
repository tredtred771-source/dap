import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Loader2, Headphones } from 'lucide-react';
import { speechService } from '../services/speech';

interface InputBarProps {
  onSendMessage: (text: string) => void;
  onOpenVoiceMode?: () => void;
  disabled?: boolean;
}

export const InputBar: React.FC<InputBarProps> = ({ onSendMessage, onOpenVoiceMode, disabled }) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || disabled) return;

    onSendMessage(inputText.trim());
    setInputText('');
    setRecordingError(null);
  };

  const handleToggleRecord = () => {
    if (isRecording) {
      speechService.stopListening();
      setIsRecording(false);
      return;
    }

    setRecordingError(null);

    const started = speechService.startListening({
      onResult: (transcript) => {
        setInputText(transcript);
      },
      onError: (err) => {
        setIsRecording(false);
        setRecordingError('لم يتم التعرف على الصوت. يمكنك أيضاً الكتابة مباشرة.');
      },
      onEnd: () => {
        setIsRecording(false);
      },
    });

    if (started) {
      setIsRecording(true);
    }
  };

  return (
    <div className="w-full">
      {recordingError && (
        <div className="mb-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/60 px-3 py-1.5 rounded-lg flex items-center justify-between" dir="rtl">
          <span>{recordingError}</span>
          <button
            type="button"
            onClick={() => setRecordingError(null)}
            className="text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </div>
      )}

      {isRecording && (
        <div className="mb-2 flex items-center justify-between bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-xl text-xs text-amber-300 animate-pulse" dir="rtl">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
            <span>جاري الاستماع لصوتك باللغة الألمانية (أو تحدث بالعربية)...</span>
          </div>
          <button
            type="button"
            onClick={handleToggleRecord}
            className="text-amber-400 font-bold underline"
          >
            إيقاف
          </button>
        </div>
      )}

      <form onSubmit={handleSend} className="relative flex items-center gap-2">
        
        {/* Voice Conversation Mode Button */}
        {onOpenVoiceMode && (
          <button
            type="button"
            id="voice-call-trigger-btn"
            onClick={onOpenVoiceMode}
            disabled={disabled}
            title="فتح وضع المحادثة الصوتية المفتوحة (تحدث واستمع باستمرار)"
            className="p-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 transition-all cursor-pointer flex items-center justify-center shrink-0"
          >
            <Headphones className="w-5 h-5" />
          </button>
        )}

        {/* Microphone Button (Speech to Text in Input) */}
        <button
          type="button"
          id="mic-record-btn"
          disabled={disabled}
          onClick={handleToggleRecord}
          title={isRecording ? 'إيقاف التسجيل' : 'التحدث بصوتك (Speech-to-Text)'}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            isRecording
              ? 'bg-rose-500 border-rose-400 text-white animate-bounce'
              : 'bg-slate-800 border-slate-700 hover:border-amber-500/60 text-slate-300 hover:text-amber-400'
          } disabled:opacity-50`}
        >
          {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Text Input */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            id="user-chat-input"
            disabled={disabled}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="اكتب ردك بالألمانية أو اسأل عن أي تعبير عامي..."
            className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm sm:text-base pr-4"
            dir="auto"
          />
        </div>

        {/* Send Button */}
        <button
          type="submit"
          id="send-message-btn"
          disabled={!inputText.trim() || disabled}
          className="p-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border border-amber-400 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-amber-500/20 active:scale-95"
        >
          {disabled ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </form>
    </div>
  );
};
