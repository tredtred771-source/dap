import React, { useState } from 'react';
import { X, Volume2, Search, BookOpen, Sparkles, CheckCircle2 } from 'lucide-react';
import { SlangTip } from '../types';

interface SlangVocabularyModalProps {
  isOpen: boolean;
  onClose: () => void;
  learnedSlang: SlangTip[];
  onPlayAudio: (text: string) => void;
}

export const SlangVocabularyModal: React.FC<SlangVocabularyModalProps> = ({
  isOpen,
  onClose,
  learnedSlang,
  onPlayAudio,
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredSlang = learnedSlang.filter(
    (item) =>
      item.term.toLowerCase().includes(search.toLowerCase()) ||
      item.formalGerman.toLowerCase().includes(search.toLowerCase()) ||
      item.explanationAr.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">دفتر العامية الألمانية الخاص بك</h3>
              <p className="text-xs text-slate-400">
                مجموع التعابير والكلمات التي تعلمتها مع صديقك ({learnedSlang.length} كلمة وتعبير)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في الكلمات أو المعاني..."
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pr-9 pl-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Vocabulary List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {filteredSlang.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-medium">لم يتم العثور على تعابير بعد.</p>
              <p className="text-xs text-slate-500 mt-1">تحدث مع صديقك وسيقوم بتعليمك كلمات جديدة تلقائياً!</p>
            </div>
          ) : (
            filteredSlang.map((item, index) => (
              <div
                key={index}
                className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 rounded-xl p-3.5 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-amber-400 font-mono" dir="ltr">
                      {item.term}
                    </span>
                    <button
                      type="button"
                      onClick={() => onPlayAudio(item.term)}
                      title="استمع للنطق"
                      className="p-1 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-700/60"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="text-xs bg-slate-900 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                    رسمي: <span className="text-slate-100 font-mono" dir="ltr">{item.formalGerman}</span>
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-2">
                  {item.explanationAr}
                </p>

                {item.example && (
                  <div className="bg-slate-950/60 rounded-lg p-2 text-xs flex items-center justify-between text-slate-300 border border-slate-900" dir="ltr">
                    <span className="italic font-mono">{item.example}</span>
                    <button
                      type="button"
                      onClick={() => onPlayAudio(item.example)}
                      className="text-amber-400 hover:text-amber-300 ml-2"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/70 text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
};
