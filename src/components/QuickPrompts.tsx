import React from 'react';
import { MessageSquarePlus } from 'lucide-react';

interface QuickPromptsProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

const QUICK_PROMPTS = [
  { text: "Na, was geht ab heute?", ar: "كيف الأمور اليوم؟" },
  { text: "Hast du Bock auf Kaffee?", ar: "هل عندك رغبة نشرب قهوة؟" },
  { text: "Ich bin mega müde, Alter!", ar: "أنا متعب جداً يا صاحبي!" },
  { text: "Was machst du am Wochenende?", ar: "ماذا ستفعل في عطلة نهاية الأسبوع؟" },
  { text: "Erzähl mir einen lustigen Witz auf Deutsch!", ar: "احكِ لي نكتة مضحكة بالألمانية!" },
  { text: "Was bedeutet 'Ich verstehe nur Bahnhof'?", ar: "ماذا تعني عبارة أفهم فقط قطار؟" },
];

export const QuickPrompts: React.FC<QuickPromptsProps> = ({ onSelectPrompt, disabled }) => {
  return (
    <div className="py-2 overflow-x-auto no-scrollbar flex items-center gap-2" dir="ltr">
      <span className="text-xs text-slate-500 shrink-0 font-medium px-1 flex items-center gap-1" dir="rtl">
        <MessageSquarePlus className="w-3.5 h-3.5 text-amber-500" />
        عبارات سريعة:
      </span>
      {QUICK_PROMPTS.map((item, idx) => (
        <button
          key={idx}
          type="button"
          disabled={disabled}
          onClick={() => onSelectPrompt(item.text)}
          className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800/90 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-750 text-slate-300 hover:text-amber-300 transition-all cursor-pointer disabled:opacity-50"
          title={item.ar}
        >
          {item.text}
        </button>
      ))}
    </div>
  );
};
