import React, { useState } from 'react';
import { Sparkles, User, MessageCircle, Volume2, CheckCircle2, ArrowRight } from 'lucide-react';
import { CompanionProfile, GermanLevel, SlangStyle, VoiceGender } from '../types';

interface CompanionSetupProps {
  initialProfile?: CompanionProfile | null;
  onComplete: (profile: CompanionProfile) => void;
}

const SUGGESTED_NAMES: { [key in VoiceGender]: string[] } = {
  female: ['Lena', 'Mia', 'Sophie', 'Emma', 'Hannah', 'Laura'],
  male: ['Lukas', 'Felix', 'Jonas', 'Leon', 'Max', 'Niklas'],
};

const AVATARS: { [key in VoiceGender]: { emoji: string; label: string }[] } = {
  female: [
    { emoji: '👩🏼', label: 'Lena' },
    { emoji: '👩🏻', label: 'Sophie' },
    { emoji: '👱🏻‍♀️', label: 'Mia' },
    { emoji: '👩🏽', label: 'Hannah' },
  ],
  male: [
    { emoji: '👨🏼', label: 'Lukas' },
    { emoji: '👨🏻', label: 'Felix' },
    { emoji: '🧔🏼', label: 'Jonas' },
    { emoji: '👱🏻‍♂️', label: 'Leon' },
  ],
};

export const CompanionSetup: React.FC<CompanionSetupProps> = ({ initialProfile, onComplete }) => {
  const [voiceGender, setVoiceGender] = useState<VoiceGender>(initialProfile?.voiceGender || 'female');
  const [companionName, setCompanionName] = useState<string>(
    initialProfile?.name || (initialProfile?.voiceGender === 'male' ? 'Lukas' : 'Lena')
  );
  const [userName, setUserName] = useState<string>(initialProfile?.userName || '');
  const [germanLevel, setGermanLevel] = useState<GermanLevel>(initialProfile?.germanLevel || 'beginner');
  const [slangStyle, setSlangStyle] = useState<SlangStyle>(initialProfile?.slangStyle || 'everyday');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(
    initialProfile?.avatar || (initialProfile?.voiceGender === 'male' ? '👨🏼' : '👩🏼')
  );

  const handleGenderChange = (gender: VoiceGender) => {
    setVoiceGender(gender);
    const newSuggested = SUGGESTED_NAMES[gender][0];
    setCompanionName(newSuggested);
    setSelectedAvatar(AVATARS[gender][0].emoji);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companionName.trim()) return;

    const profile: CompanionProfile = {
      name: companionName.trim(),
      voiceGender,
      avatar: selectedAvatar,
      userName: userName.trim() || 'صديقي العزيز',
      germanLevel,
      slangStyle,
      createdAt: new Date().toISOString(),
    };

    onComplete(profile);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="w-full max-w-2xl bg-slate-800/90 backdrop-blur-md rounded-2xl border border-slate-700/80 p-6 sm:p-8 shadow-2xl shadow-black/40">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-3xl mb-4">
            🇩🇪
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            DeutschBuddy | صديقك الرقمي للعامية الألمانية
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-lg mx-auto">
            اختر صديقك الألماني لتبدأ ممارسة اللغة الألمانية المحكية (Umgangssprache) بصوت طبيعي وتصحيح فوري لأخطائك.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Step 1: Voice & Gender */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-300">
              ١. اختر صوت الصديق (بنت 👩 أو شب 👨)
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                id="select-female-voice"
                onClick={() => handleGenderChange('female')}
                className={`flex items-center justify-center gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                  voiceGender === 'female'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300 ring-2 ring-amber-500/30'
                    : 'border-slate-700 bg-slate-800 hover:border-slate-600 text-slate-300'
                }`}
              >
                <span className="text-3xl">👩</span>
                <div className="text-right">
                  <div className="font-semibold text-base">بنت (صوت أنثوي)</div>
                  <div className="text-xs text-slate-400">نبرة ودية ومشجعة</div>
                </div>
              </button>

              <button
                type="button"
                id="select-male-voice"
                onClick={() => handleGenderChange('male')}
                className={`flex items-center justify-center gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                  voiceGender === 'male'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300 ring-2 ring-amber-500/30'
                    : 'border-slate-700 bg-slate-800 hover:border-slate-600 text-slate-300'
                }`}
              >
                <span className="text-3xl">👨</span>
                <div className="text-right">
                  <div className="font-semibold text-base">شب (صوت رجالي)</div>
                  <div className="text-xs text-slate-400">نبرة عفوية وشبابية</div>
                </div>
              </button>
            </div>
          </div>

          {/* Step 2: Companion Name & Avatar */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-300">
              ٢. اسم صديقك وشكله
            </label>
            
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              {/* Avatar Selection */}
              <div className="flex gap-2">
                {AVATARS[voiceGender].map((item) => (
                  <button
                    key={item.emoji}
                    type="button"
                    onClick={() => setSelectedAvatar(item.emoji)}
                    className={`w-12 h-12 rounded-xl text-2xl flex items-center justify-center border transition-transform cursor-pointer ${
                      selectedAvatar === item.emoji
                        ? 'border-amber-500 bg-amber-500/20 scale-105'
                        : 'border-slate-700 bg-slate-800/80 hover:scale-100'
                    }`}
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>

              {/* Name Input */}
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  id="companion-name-input"
                  value={companionName}
                  onChange={(e) => setCompanionName(e.target.value)}
                  placeholder="أدخل اسم الصديق..."
                  required
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-base"
                />
              </div>
            </div>

            {/* Quick Suggestions */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-xs text-slate-400">اقتراحات سريعة:</span>
              {SUGGESTED_NAMES[voiceGender].map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setCompanionName(name)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                    companionName === name
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: User's Name */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-300">
              ٣. اسمك أنت (ليخاطبك به صديقك أثناء المحادثة)
            </label>
            <input
              type="text"
              id="user-name-input"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="مثلاً: سامي، سارة، Alex..."
              className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-base"
            />
          </div>

          {/* Step 4: Level & Slang Vibe */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-300">
                مستواك الحالي في الألمانية
              </label>
              <select
                id="german-level-select"
                value={germanLevel}
                onChange={(e) => setGermanLevel(e.target.value as GermanLevel)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="beginner">مبتدئ (A1 - A2) - كلمات سهلة وتوضيح أكبر</option>
                <option value="intermediate">متوسط (B1 - B2) - محادثة واقعية وسريعة</option>
                <option value="advanced">متقدم (C1+) - عامية دقيقة ومكثفة</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-300">
                نوع العامية المفضلة
              </label>
              <select
                id="slang-style-select"
                value={slangStyle}
                onChange={(e) => setSlangStyle(e.target.value as SlangStyle)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="everyday">عامية يومية شائعة (Alltagssprache)</option>
                <option value="youth">عامية الشباب والشارع (Jugendsprache)</option>
                <option value="berlin">نكهة برلين العصرية (Berlinerisch)</option>
              </select>
            </div>
          </div>

          {/* Live Preview of Greeting */}
          <div className="bg-slate-900/70 border border-slate-700/60 rounded-xl p-4 flex items-start gap-3">
            <span className="text-3xl mt-0.5">{selectedAvatar}</span>
            <div className="space-y-1">
              <div className="text-xs text-amber-400 font-medium">
                معاينة أول رسالة من {companionName || 'صديقك'}:
              </div>
              <p className="text-sm text-slate-300 italic" dir="ltr">
                "Moin {userName.trim() || 'du'}! Na, wie geht's dir heute? Schön, dass du da bist! Lass uns ein bisschen quatschen."
              </p>
              <div className="text-xs text-slate-400">
                (مرحباً {userName.trim() || 'يا صديقي'}! كيف حالك اليوم؟ من الرائع وجودك هنا! هيا لنتسامر ونتبادل الحديث.)
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            id="start-companion-btn"
            className="w-full py-4 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-lg shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <span>ابدأ المحادثة مع {companionName}</span>
            <ArrowRight className="w-5 h-5 rotate-180" />
          </button>
        </form>

      </div>
    </div>
  );
};
