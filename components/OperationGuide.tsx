import React from 'react';
import { Language } from '../types';
import { translations } from '../i18n';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    lang: Language;
}

export const OperationGuide: React.FC<Props> = ({ isOpen, onClose, lang }) => {
    if (!isOpen) return null;
    const t = translations[lang];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="p-4 sm:p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                    <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                        <span>🎮</span> {t.gesturesTitle}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-700 rounded-lg"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-4 sm:p-6 text-slate-300 space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        {/* Move - Fist */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex items-start gap-4 hover:bg-slate-800 transition-colors">
                            <div className="text-4xl bg-slate-700 w-16 h-16 flex items-center justify-center rounded-lg shrink-0">
                                ✊
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-cyan-400 mb-1">{t.moveTitle}</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    {t.moveDesc}
                                </p>
                            </div>
                        </div>

                        {/* Split - Victory */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex items-start gap-4 hover:bg-slate-800 transition-colors">
                            <div className="text-4xl bg-slate-700 w-16 h-16 flex items-center justify-center rounded-lg shrink-0">
                                ✌️
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-yellow-400 mb-1">{t.splitTitle}</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    {t.splitDesc}
                                </p>
                            </div>
                        </div>

                        {/* Eject - Open Hand */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex items-start gap-4 hover:bg-slate-800 transition-colors">
                            <div className="text-4xl bg-slate-700 w-16 h-16 flex items-center justify-center rounded-lg shrink-0">
                                🖐️
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-rose-400 mb-1">{t.ejectTitle}</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    {t.ejectDesc}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-700/50 text-center">
                        <button
                            onClick={onClose}
                            className="px-8 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold rounded-full transition-all shadow-lg shadow-cyan-500/20"
                        >
                            {lang === 'zh' ? '明白了' : 'Got it!'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
