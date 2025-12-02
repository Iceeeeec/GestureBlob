import React, { useState, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { ArchitectureDocs } from './components/ArchitectureDocs';
import { Logo } from './components/Logo';
import { GameStatus, LeaderboardEntry, Language } from './types';
import { translations } from './i18n';

export default function App() {
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.LOADING_MODEL);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [rank, setRank] = useState(0);
  const [lang, setLang] = useState<Language>('zh');

  const t = translations[lang];

  useEffect(() => {
    const saved = localStorage.getItem('gestureAgar_highScore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const handleScoreUpdate = (newScore: number) => {
    setScore(newScore);
    if (newScore > highScore) {
      setHighScore(newScore);
      localStorage.setItem('gestureAgar_highScore', newScore.toString());
    }
  };
  
  const handleLeaderboardUpdate = (list: LeaderboardEntry[]) => {
      setLeaderboard(list);
      // Calculate Rank (1-based index)
      const myIndex = list.findIndex(e => e.isPlayer);
      if (myIndex !== -1) {
          setRank(myIndex + 1);
      } else {
          setRank(0); // Not found (Game Over)
      }
  };

  const toggleGame = () => {
    if (gameStatus === GameStatus.PLAYING) {
      setGameStatus(GameStatus.IDLE);
    } else {
      setGameStatus(GameStatus.PLAYING);
    }
  };

  const toggleLang = () => {
    setLang(prev => prev === 'en' ? 'zh' : 'en');
  };

  const getButtonConfig = () => {
    switch (gameStatus) {
        case GameStatus.PLAYING:
            return {
                text: t.endGame,
                style: 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30'
            };
        case GameStatus.GAME_OVER:
            return {
                text: t.respawn,
                style: 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-cyan-500/30 animate-pulse'
            };
        default:
            return {
                text: t.startGame,
                style: 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-cyan-500/30 animate-pulse'
            };
    }
  };

  const btnConfig = getButtonConfig();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between bg-slate-900 border-b border-slate-800">
        {/* Use the new Logo Component */}
        <Logo />
        
        <nav className="flex gap-4 items-center">
          <button 
            onClick={toggleLang}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold uppercase transition-colors"
          >
            {lang === 'en' ? '中文' : 'EN'}
          </button>
          <button 
            onClick={() => setIsDocsOpen(true)}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            {t.architecture}
          </button>
        </nav>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 container mx-auto p-4 lg:p-6 flex flex-col lg:flex-row gap-6">
        
        {/* Game Viewport */}
        <div className="flex-1 flex flex-col gap-4">
            <div className="aspect-video w-full rounded-3xl overflow-hidden shadow-2xl shadow-cyan-900/10 border-2 border-slate-800 relative bg-black">
                <GameCanvas 
                  onScoreUpdate={handleScoreUpdate}
                  onStatusChange={setGameStatus}
                  onLeaderboardUpdate={handleLeaderboardUpdate}
                  gameStatus={gameStatus}
                  lang={lang}
                />
            </div>
            
            {/* Controls */}
            <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <div className="flex gap-2">
                   <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
                      {t.mode}
                   </div>
                   <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
                      {t.control}
                   </div>
                </div>
                
                <div className="flex gap-4">
                    {gameStatus !== GameStatus.LOADING_MODEL && (
                        <button
                          onClick={toggleGame}
                          className={`
                            px-8 py-3 rounded-full font-bold text-lg shadow-lg transition-all transform hover:scale-105 active:scale-95
                            ${btnConfig.style}
                          `}
                        >
                          {btnConfig.text}
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* Sidebar / HUD */}
        <aside className="w-full lg:w-80 flex flex-col gap-6">
            
            {/* Leaderboard */}
            {gameStatus === GameStatus.PLAYING && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 overflow-hidden">
                 <h3 className="font-bold text-white mb-3 text-sm uppercase tracking-wider flex items-center justify-between">
                    {t.leaderboard}
                    <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">{t.top10}</span>
                 </h3>
                 <div className="space-y-2">
                    {leaderboard.slice(0, 10).map((entry, idx) => (
                       <div key={entry.id} className={`flex items-center justify-between text-sm p-2 rounded-lg ${entry.isPlayer ? 'bg-cyan-500/20 border border-cyan-500/30' : 'bg-slate-800/50'}`}>
                          <div className="flex items-center gap-3">
                             <span className={`w-5 h-5 flex items-center justify-center text-xs font-bold rounded ${idx < 3 ? 'text-black bg-yellow-400' : 'text-slate-400 bg-slate-700'}`}>
                                {idx + 1}
                             </span>
                             <span className={entry.isPlayer ? 'text-cyan-300 font-bold' : 'text-slate-300'}>
                                {entry.isPlayer ? t.you : entry.name}
                             </span>
                          </div>
                          <span className="font-mono text-slate-400">{entry.mass}</span>
                       </div>
                    ))}
                    {leaderboard.length === 0 && <div className="text-slate-500 text-xs text-center py-2">{t.waiting}</div>}
                 </div>
              </div>
            )}

            {/* Score Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                
                <div className="relative z-10">
                    <h2 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">{t.totalMass}</h2>
                    <div className="text-6xl font-black text-white mb-6 tabular-nums tracking-tighter">
                        {Math.floor(score).toString().padStart(2, '0')}
                    </div>
                    
                    <div className="flex justify-between items-end border-t border-slate-800 pt-4">
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-semibold">{t.record}</p>
                            <p className="text-2xl font-bold text-cyan-400 tabular-nums">{Math.floor(highScore)}</p>
                        </div>
                        <div className="text-right">
                             <p className="text-xs text-slate-500 uppercase font-semibold">{t.rank}</p>
                             <p className="text-2xl font-bold text-yellow-400 tabular-nums">
                                {rank > 0 ? `#${rank}` : '-'}
                             </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Instructions */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t.gesturesTitle}
                </h3>
                <ul className="space-y-4 text-sm text-slate-400">
                    <li className="flex gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                        <span>
                           <strong>{t.moveTitle}</strong><br/>
                           <span className="text-slate-500 text-xs">{t.moveDesc}</span>
                        </span>
                    </li>
                    <li className="flex gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-yellow-400 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                        <span>
                           <strong>{t.splitTitle}</strong><br/>
                           <span className="text-slate-500 text-xs">{t.splitDesc}</span>
                        </span>
                    </li>
                    <li className="flex gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-rose-500 flex items-center justify-center font-bold text-xs shrink-0">3</span>
                        <span>
                           <strong>{t.ejectTitle}</strong><br/>
                           <span className="text-slate-500 text-xs">{t.ejectDesc}</span>
                        </span>
                    </li>
                </ul>
            </div>
        </aside>
      </main>

      <ArchitectureDocs isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} lang={lang} />
    </div>
  );
}
