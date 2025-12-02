
import React from 'react';
import { Language } from '../types';
import { translations } from '../i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const ArchitectureDocs: React.FC<Props> = ({ isOpen, onClose, lang }) => {
  if (!isOpen) return null;
  const t = translations[lang];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800">
          <h2 className="text-2xl font-bold text-white">{t.docsTitle}</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto text-slate-300 space-y-6 leading-relaxed">
          
          <section>
            <h3 className="text-xl font-semibold text-sky-400 mb-3">{t.section1Title}</h3>
            <p className="mb-2">
              {t.section1Text}
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-slate-400 pl-4">
               <li><strong>{t.section1List1}</strong></li>
               <li><strong>{t.section1List2}</strong></li>
               <li><strong>{t.section1List3}</strong></li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-emerald-400 mb-3">{t.section2Title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800 p-4 rounded-lg">
                <h4 className="font-bold text-white mb-2">{t.sec2PalmTitle}</h4>
                <p className="text-xs">
                   {t.sec2PalmDesc}
                </p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg">
                <h4 className="font-bold text-yellow-400 mb-2">{t.sec2SplitTitle}</h4>
                <p className="text-xs">
                  {t.sec2SplitDesc}
                </p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg">
                <h4 className="font-bold text-rose-400 mb-2">{t.sec2EjectTitle}</h4>
                <p className="text-xs">
                  {t.sec2EjectDesc}
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-purple-400 mb-3">{t.section3Title}</h3>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <span className="font-mono text-xs bg-slate-700 px-2 py-1 rounded h-fit">MASS</span>
                <span>
                  {t.sec3Mass} <code>Speed = BaseSpeed * (Radius ^ -0.4)</code>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono text-xs bg-slate-700 px-2 py-1 rounded h-fit">SPLIT</span>
                <span>
                  {t.sec3Split} <code>Area_New = Area_Old / 2</code>.
                </span>
              </li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  );
};