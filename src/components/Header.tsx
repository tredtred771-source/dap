import React, { useState } from 'react';
import { Volume2, VolumeX, BookOpen, Settings, Zap, HardDrive, Info, X, ShieldCheck, Mic, Server, CheckCircle2, AlertTriangle } from 'lucide-react';
import { CompanionProfile, DailyUsage } from '../types';
import { getApiBaseUrl, setCustomApiUrl, isAndroidWebView } from '../services/config';
import { getServerHealth } from '../services/api';

interface HeaderProps {
  companion: CompanionProfile;
  isSpeaking: boolean;
  autoPlayAudio: boolean;
  onToggleAutoPlay: () => void;
  onOpenVoiceMode: () => void;
  onOpenVocabulary: () => void;
  onChangeCompanion: () => void;
  learnedSlangCount: number;
  dailyUsage: DailyUsage;
  onClearHistory: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  companion,
  isSpeaking,
  autoPlayAudio,
  onToggleAutoPlay,
  onOpenVoiceMode,
  onOpenVocabulary,
  onChangeCompanion,
  learnedSlangCount,
  dailyUsage,
  onClearHistory,
}) => {
  const [showUsageModal, setShowUsageModal] = useState<boolean>(false);
  const [isTestingServer, setIsTestingServer] = useState<boolean>(false);
  const [serverTestResult, setServerTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [customUrlInput, setCustomUrlInput] = useState<string>(() => getApiBaseUrl());
  const [showUrlEditor, setShowUrlEditor] = useState<boolean>(false);

  const percentUsed = Math.min(100, Math.round((dailyUsage.count / dailyUsage.limit) * 100));
  const isNearLimit = dailyUsage.count >= 1200;

  const handleTestConnection = async () => {
    setIsTestingServer(true);
    setServerTestResult(null);
    try {
      const health = await getServerHealth();
      if (health.geminiReady && !health.error) {
        setServerTestResult({
          ok: true,
          message: `متصل بنجاح! الخادم السحابي جاهز وGemini يعمل بشكل ممتاز.`,
        });
      } else {
        setServerTestResult({
          ok: false,
          message: health.error || 'فشل الاتصال بالخادم السحابي. تحقق من العنوان.',
        });
      }
    } catch (e: any) {
      setServerTestResult({
        ok: false,
        message: e?.message || 'تعذر الوصول إلى الخادم.',
      });
    } finally {
      setIsTestingServer(false);
    }
  };

  const handleSaveCustomUrl = () => {
    setCustomApiUrl(customUrlInput.trim());
    setServerTestResult(null);
    handleTestConnection();
  };

  return (
    <>
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-3.5 py-2.5 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2.5">
          
          {/* Companion Avatar & Info */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="relative">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xl sm:text-2xl shadow-inner">
                {companion.avatar}
              </div>
              {isSpeaking && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 className="text-white font-bold text-sm sm:text-base flex items-center gap-1">
                  <span>{companion.name}</span>
                  <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-normal border border-slate-700">
                    {companion.voiceGender === 'female' ? 'بنت 👩' : 'شب 👨'}
                  </span>
                </h2>
              </div>
              
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>متصل</span>
                </span>
                <span>•</span>
                <span>عامية {companion.slangStyle === 'youth' ? 'شبابية' : companion.slangStyle === 'berlin' ? 'برلين' : 'يومية'}</span>
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            
            {/* Live Voice Conversation Mode Button */}
            <button
              type="button"
              id="open-voice-mode-btn"
              onClick={onOpenVoiceMode}
              title="بدء محادثة صوتية تفاعلية حية (تحدث واستمع باستمرار)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 border border-emerald-400 shadow-md shadow-emerald-500/25 transition-all cursor-pointer active:scale-95"
            >
              <Mic className="w-3.5 h-3.5 fill-current" />
              <span>محادثة صوتية 🎙️</span>
            </button>

            {/* Daily Gemini Quota Indicator */}
            <button
              type="button"
              id="gemini-quota-btn"
              onClick={() => setShowUsageModal(true)}
              title="عرض استهلاك الحد المجاني اليومي لـ Gemini (1,500 طلب/يوم)"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                isNearLimit
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 animate-pulse'
                  : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-amber-300'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${isNearLimit ? 'text-rose-400' : 'text-amber-400'}`} />
              <span className="hidden md:inline text-[11px]">مجاني:</span>
              <span className="font-mono text-[11px] font-semibold">
                {dailyUsage.count}/{dailyUsage.limit}
              </span>
            </button>

            {/* Audio Autoplay Toggle (Web Speech API) */}
            <button
              type="button"
              id="toggle-autoplay-btn"
              onClick={onToggleAutoPlay}
              title={autoPlayAudio ? 'تشغيل الصوت تلقائياً عبر متصفحك (مفعل)' : 'تشغيل الصوت يدوياً'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                autoPlayAudio
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {autoPlayAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{autoPlayAudio ? 'صوت تلقائي' : 'صوت صامت'}</span>
            </button>

            {/* Vocabulary / Slang Book */}
            <button
              type="button"
              id="open-vocabulary-btn"
              onClick={onOpenVocabulary}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 hover:bg-slate-750 transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">دفتر العامية</span>
              {learnedSlangCount > 0 && (
                <span className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.2 rounded-full text-[10px]">
                  {learnedSlangCount}
                </span>
              )}
            </button>

            {/* Change Companion / Settings */}
            <button
              type="button"
              id="change-companion-btn"
              onClick={onChangeCompanion}
              title="تغيير الصديق أو الإعدادات"
              className="p-2 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>

          </div>

        </div>
      </header>

      {/* Usage & System Plan Modal */}
      {showUsageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 text-right shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowUsageModal(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3 text-amber-400">
              <Zap className="w-5 h-5" />
              <h3 className="font-bold text-base text-white">خطة التشغيل المجانية 100%</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              تم إعداد تطبيق <span className="text-amber-300 font-semibold">DeutschBuddy</span> ليكون مجانياً بالكامل للأبد بدون الحاجة لأي بطاقة ائتمان، ومناسباً للممارسة المكثفة من 4 إلى 5 ساعات يومياً.
            </p>

            {/* Daily Usage Progress Bar */}
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3.5 mb-4">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-slate-300 font-medium">الاستهلاك اليومي لـ Gemini:</span>
                <span className="font-mono text-amber-400 font-bold">
                  {dailyUsage.count} / {dailyUsage.limit} طلب
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-700">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    isNearLimit ? 'bg-rose-500' : 'bg-gradient-to-l from-amber-400 to-emerald-400'
                  }`}
                  style={{ width: `${percentUsed}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                تتيح لك باقة Google AI Studio المجانية حتى <strong className="text-white">1,500 طلب/يوم</strong> (يتجدد العداد تلقائياً كل منتصف ليل). حتى مع إرسال رسالة كل دقيقة، لن تتجاوز 300 طلب خلال 5 ساعات كاملة!
              </p>
            </div>

            {/* Features Info */}
            <div className="space-y-2.5 text-xs text-slate-300 mb-5">
              <div className="flex items-start gap-2 bg-slate-800/40 p-2.5 rounded-lg border border-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">صوت مجاني بالكامل (Web Speech API):</strong>
                  نطق وتحدث مباشر عبر محرك متصفحك المحلي بلا خوادم خارجية وبلا تكلفة ولا حدود استهلاك.
                </div>
              </div>

              <div className="flex items-start gap-2 bg-slate-800/40 p-2.5 rounded-lg border border-slate-800">
                <HardDrive className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">حفظ محلي فوري (LocalStorage):</strong>
                  جميع محادثاتك ومفرداتك وذاكرة الصديق مخزنة بأمان على جهازك دون الحاجة لقواعد بيانات سحابية مدفوعة.
                </div>
              </div>

              {/* Server Connection & Diagnostics for Android APK & Web */}
              <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/70 text-right">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-emerald-400" />
                    <strong className="text-white text-xs">اتصال السيرفر (Android APK / Cloud):</strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTestingServer}
                    className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isTestingServer ? 'جاري الفحص...' : 'فحص الاتصال 📡'}
                  </button>
                </div>

                <div className="text-[11px] text-slate-400 font-mono break-all dir-ltr text-left bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
                  {getApiBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : 'Current Host')}
                </div>

                {serverTestResult && (
                  <div
                    className={`mt-2 p-2 rounded text-[11px] flex items-start gap-1.5 ${
                      serverTestResult.ok
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {serverTestResult.ok ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                    )}
                    <span>{serverTestResult.message}</span>
                  </div>
                )}

                <div className="mt-2 text-left">
                  <button
                    type="button"
                    onClick={() => setShowUrlEditor(!showUrlEditor)}
                    className="text-[10px] text-slate-400 hover:text-amber-300 underline cursor-pointer"
                  >
                    {showUrlEditor ? 'إخفاء إعدادات الرابط' : 'تعديل عنوان السيرفر يدوياً (لـ APK)'}
                  </button>

                  {showUrlEditor && (
                    <div className="mt-1.5 flex gap-1.5">
                      <input
                        type="url"
                        value={customUrlInput}
                        onChange={(e) => setCustomUrlInput(e.target.value)}
                        placeholder="https://your-server.run.app"
                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 font-mono dir-ltr focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleSaveCustomUrl}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded transition-colors cursor-pointer"
                      >
                        حفظ
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('هل أنت متأكد من رغبتك في مسح سجل المحادثات والبدء من جديد؟')) {
                    onClearHistory();
                    setShowUsageModal(false);
                  }
                }}
                className="text-xs text-rose-400 hover:text-rose-300 underline cursor-pointer"
              >
                مسح سجل المحادثات
              </button>

              <button
                type="button"
                onClick={() => setShowUsageModal(false)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                متابعة الدردشة
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
