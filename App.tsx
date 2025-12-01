
import React, { useState, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { ArchitectureDocs } from './components/ArchitectureDocs';
import { GameStatus } from './types';

export default function App() {
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.LOADING_MODEL);
  const [isDocsOpen, setIsDocsOpen] = useState(false);

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

  const toggleGame = () => {
    if (gameStatus === GameStatus.PLAYING) {
      setGameStatus(GameStatus.IDLE);
    } else {
      setGameStatus(GameStatus.PLAYING);
    }
  };

  const getButtonConfig = () => {
    switch (gameStatus) {
        case GameStatus.PLAYING:
            return {
                text: 'End Game',
                style: 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30'
            };
        case GameStatus.GAME_OVER:
            return {
                text: 'Respawn',
                style: 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-cyan-500/30 animate-pulse'
            };
        default:
            return {
                text: 'Start Game',
                style: 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-cyan-500/30 animate-pulse'
            };
    }
  };

  const btnConfig = getButtonConfig();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-cyan-400 to-blue-500 rounded-full shadow-lg shadow-cyan-500/20"></div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">
            Gesture Agar
          </h1>
        </div>
        
        <nav className="flex gap-4">
          <button 
            onClick={() => setIsDocsOpen(true)}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
          >
            Architecture
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
                  gameStatus={gameStatus}
                />
            </div>
            
            {/* Controls */}
            <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <div className="flex gap-2">
                   <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
                      Mode: AI Arena
                   </div>
                   <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
                      Vision: Hand Landmark
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
            {/* Score Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                
                <div className="relative z-10">
                    <h2 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Current Mass</h2>
                    <div className="text-6xl font-black text-white mb-6 tabular-nums tracking-tighter">
                        {Math.floor(score).toString().padStart(2, '0')}
                    </div>
                    
                    <div className="flex justify-between items-end border-t border-slate-800 pt-4">
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-semibold">Record Size</p>
                            <p className="text-2xl font-bold text-cyan-400 tabular-nums">{Math.floor(highScore)}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-cyan-500">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                             <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                           </svg>
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
                    How to Play
                </h3>
                <ul className="space-y-4 text-sm text-slate-400">
                    <li className="flex gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                        <span>Move with <strong>Palm Center</strong> (Open Hand).</span>
                    </li>
                    <li className="flex gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-rose-500 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                        <span>
                           <strong>Open Hand (Hold)</strong> to eject mass.<br/>
                           <span className="text-slate-500 text-xs">Extend Middle+Ring+Pinky fully.</span>
                        </span>
                    </li>
                    <li className="flex gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-yellow-400 flex items-center justify-center font-bold text-xs shrink-0">3</span>
                        <span>Eat smaller <strong>AI Bots</strong>, avoid bigger ones!</span>
                    </li>
                </ul>
            </div>
        </aside>
      </main>

      <ArchitectureDocs isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} />
    </div>
  );
}
