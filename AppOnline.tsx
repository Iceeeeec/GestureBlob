import React, { useState, useEffect } from 'react';
import { Lobby } from './components/Lobby';
import { OnlineGameCanvas } from './components/OnlineGameCanvas';
import { ArchitectureDocs } from './components/ArchitectureDocs';
import { OperationGuide } from './components/OperationGuide';
import { Logo } from './components/Logo';
import { GameStatus, LeaderboardEntry, Language } from './types';
import { translations } from './i18n';
import { gameSocket } from './network/socket';
import { RoomPlayer } from './network/protocol';

type AppView = 'lobby' | 'game';

interface AppOnlineProps {
  onBack?: () => void;
}

export default function AppOnline({ onBack }: AppOnlineProps) {
  const [view, setView] = useState<AppView>('lobby');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.LOADING_MODEL);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rank, setRank] = useState(0);
  const [lang, setLang] = useState<Language>('zh');
  const [playerId, setPlayerId] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [gameOverWinner, setGameOverWinner] = useState<string | null>(null);
  const [remainingTime, setRemainingTime] = useState(30);
  const [showResult, setShowResult] = useState(false);
  const [finalLeaderboard, setFinalLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [returnToRoom, setReturnToRoom] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [ping, setPing] = useState(0);

  const t = translations[lang];

  // 格式化时间 mm:ss
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const saved = localStorage.getItem('gestureAgar_highScore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  // 监听时间更新和游戏结束
  useEffect(() => {
    gameSocket.connect({
      onTimeUpdate: (seconds) => {
        setRemainingTime(seconds);
      },
      onGameEnded: (lb) => {
        setFinalLeaderboard(lb);
        setShowResult(true);
      },
      onPingUpdate: (p) => {
        setPing(p);
      }
    });
  }, []);

  // 注意：房间相关事件由 Lobby 组件处理
  // 这里只处理游戏进行中的事件

  const handleScoreUpdate = (newScore: number) => {
    setScore(newScore);
    if (newScore > highScore) {
      setHighScore(newScore);
      localStorage.setItem('gestureAgar_highScore', newScore.toString());
    }
  };

  const handleLeaderboardUpdate = (list: LeaderboardEntry[]) => {
    setLeaderboard(list);
    const myIndex = list.findIndex(e => e.isPlayer);
    setRank(myIndex !== -1 ? myIndex + 1 : 0);
  };

  const handleGameStart = (id: string, code: string, host: boolean, name: string) => {
    setPlayerId(id);
    setRoomCode(code);
    setIsHost(host);
    setPlayerName(name);
    setView('game');
    setGameStatus(GameStatus.LOADING_MODEL);
    setShowResult(false);
    setReturnToRoom(false);
    setRemainingTime(300); // 重置为默认时间，服务端会发送实际时间
  };

  const handleBackToLobby = () => {
    gameSocket.leaveRoom();
    setView('lobby');
    setRoomCode('');
    setPlayers([]);
    setGameStatus(GameStatus.IDLE);
    setGameOverWinner(null);
    setShowResult(false);
    setReturnToRoom(false);
  };

  const handlePlayAgain = () => {
    // 返回房间等待界面，不离开房间
    setShowResult(false);
    setGameStatus(GameStatus.IDLE);
    setView('lobby');
    setReturnToRoom(true);
  };

  const handleRespawn = () => {
    gameSocket.respawn();
    setGameStatus(GameStatus.PLAYING);
    setGameOverWinner(null);
  };

  const toggleLang = () => {
    setLang(prev => prev === 'en' ? 'zh' : 'en');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { });
    }
  };

  // 监听全屏状态变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // 手机端自动请求横屏全屏
  useEffect(() => {
    if (view !== 'game') return; // 只在游戏视图请求

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      const requestLandscapeFullscreen = async () => {
        try {
          await document.documentElement.requestFullscreen();
          setIsFullscreen(true);

          if (screen.orientation && (screen.orientation as any).lock) {
            try {
              await (screen.orientation as any).lock('landscape');
            } catch (e) {
              console.log('Orientation lock not supported');
            }
          }
        } catch (e) {
          console.log('Fullscreen not supported or denied');
        }
      };

      const timer = setTimeout(requestLandscapeFullscreen, 500);
      return () => clearTimeout(timer);
    }
  }, [view]);

  // 大厅视图
  if (view === 'lobby') {
    return (
      <div className="min-h-screen bg-slate-950">
        <header className="px-6 py-4 flex items-center justify-between bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="px-3 py-2 text-slate-400 hover:text-white transition-colors"
              >
                ← 返回
              </button>
            )}
            <Logo />
            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">联机模式</span>
          </div>
          <div className="flex items-center gap-3">
            {/* 延迟显示 */}
            <span className={`text-xs px-2 py-1 rounded font-mono ${ping < 50 ? 'bg-green-500/20 text-green-400' :
              ping < 100 ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-rose-500/20 text-rose-400'
              }`}>
              {ping}ms
            </span>
            <button
              onClick={() => setIsGuideOpen(true)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold uppercase transition-colors flex items-center gap-1"
              title={lang === 'zh' ? '操作指南' : 'Guide'}
            >
              <span className="text-base">🎮</span>
              <span className="hidden sm:inline">{lang === 'zh' ? '指南' : 'Guide'}</span>
            </button>
            <button
              onClick={toggleLang}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold uppercase transition-colors"
            >
              {lang === 'en' ? '中文' : 'EN'}
            </button>
          </div>
        </header>
        <Lobby
          lang={lang}
          onGameStart={handleGameStart}
          initialRoomState={returnToRoom ? { roomCode, playerId, isHost, playerName } : undefined}
        />
        <OperationGuide isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} lang={lang} />
      </div>
    );
  }

  // 游戏视图
  return (
    <div className="h-screen overflow-hidden bg-slate-950 text-white flex flex-col font-sans">
      {/* Header - 简化版 */}
      <header className="px-3 sm:px-6 py-2 flex items-center justify-between bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="hidden sm:block"><Logo /></span>
          <div className="text-xs bg-slate-800 px-2 py-1 rounded-full text-cyan-400 font-mono">
            {roomCode}
          </div>
          <span className={`text-xs px-2 py-1 rounded font-mono ${ping < 50 ? 'bg-green-500/20 text-green-400' :
            ping < 100 ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-rose-500/20 text-rose-400'
            }`}>
            {ping}ms
          </span>
        </div>
        <nav className="flex gap-2 items-center">
          <button
            onClick={() => setIsGuideOpen(true)}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold uppercase transition-colors flex items-center gap-1"
            title={lang === 'zh' ? '操作指南' : 'Guide'}
          >
            <span className="text-base">🎮</span>
            <span className="hidden sm:inline">{lang === 'zh' ? '指南' : 'Guide'}</span>
          </button>
          <button
            onClick={toggleLang}
            className="hidden sm:block px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold uppercase transition-colors"
          >
            {lang === 'en' ? '中文' : 'EN'}
          </button>
          <button
            onClick={handleBackToLobby}
            className="px-3 py-1 text-xs font-medium text-rose-400 hover:text-rose-300 transition-colors"
          >
            {lang === 'zh' ? '退出' : 'Leave'}
          </button>
        </nav>
      </header>

      {/* Main Game Area - 全屏优化 */}
      <main className="flex-1 p-2 sm:p-4 flex flex-col min-h-0">
        {/* Game Viewport */}
        <div className="flex-1 relative rounded-xl overflow-hidden border border-slate-800 bg-black">
          {/* 时间显示 - 游戏正上方 */}
          <div className="absolute top-2 sm:top-4 left-1/2 -translate-x-1/2 z-30">
            <div className={`text-base sm:text-xl font-mono font-bold px-3 sm:px-4 py-1 rounded-lg backdrop-blur-sm ${remainingTime <= 30 ? 'bg-rose-500/40 text-white animate-pulse' :
              remainingTime <= 60 ? 'bg-yellow-500/40 text-white' :
                'bg-black/50 text-white'
              }`}>
              ⏱ {formatTime(remainingTime)}
            </div>
          </div>

          {/* 排行榜 - 游戏左上角半透明 */}
          {gameStatus === GameStatus.PLAYING && leaderboard.length > 0 && (
            <div className="absolute top-2 sm:top-4 left-2 sm:left-4 z-30 w-32 sm:w-48">
              <div className="bg-black/50 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-white/10">
                <h3 className="text-[10px] sm:text-xs font-bold text-white/80 mb-1 sm:mb-2 uppercase tracking-wider">
                  {t.leaderboard}
                </h3>
                <div className="space-y-0.5 sm:space-y-1">
                  {leaderboard.slice(0, 5).map((entry, idx) => (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between text-[10px] sm:text-xs py-0.5 ${entry.isPlayer ? 'text-cyan-400 font-bold' : 'text-white/70'
                        }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className={`w-3 sm:w-4 text-center ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : ''
                          }`}>
                          {idx + 1}
                        </span>
                        <span className="truncate max-w-[60px] sm:max-w-[80px]">
                          {entry.isPlayer ? t.you : entry.name}
                        </span>
                      </div>
                      <span className="font-mono">{entry.mass}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 全屏按钮 - 右上角 */}
          <button
            onClick={toggleFullscreen}
            className="absolute top-2 sm:top-4 right-2 sm:right-4 z-30 w-8 h-8 sm:w-10 sm:h-10 bg-black/50 backdrop-blur-sm rounded-lg border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all"
            title={isFullscreen ? (lang === 'zh' ? '退出全屏' : 'Exit Fullscreen') : (lang === 'zh' ? '全屏' : 'Fullscreen')}
          >
            {isFullscreen ? (
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>

          {/* 分数显示 - 右下角 */}
          <div className="absolute bottom-2 sm:bottom-4 right-2 sm:right-4 z-30">
            <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 border border-white/10">
              <div className="text-[10px] sm:text-xs text-white/60 uppercase">{t.totalMass}</div>
              <div className="text-lg sm:text-2xl font-bold text-white tabular-nums">{Math.floor(score)}</div>
            </div>
          </div>

          <OnlineGameCanvas
            playerId={playerId}
            onScoreUpdate={handleScoreUpdate}
            onStatusChange={setGameStatus}
            onLeaderboardUpdate={handleLeaderboardUpdate}
            gameStatus={gameStatus}
            lang={lang}
            onGameOver={setGameOverWinner}
          />

          {/* Death Overlay - 玩家死亡时显示（游戏未结束时） */}
          {gameStatus === GameStatus.GAME_OVER && !showResult && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-50 p-4">
              <h2 className="text-2xl sm:text-4xl font-black text-rose-500 mb-2 text-center">
                {lang === 'zh' ? '你被吃掉了!' : 'You got eaten!'}
              </h2>
              <p className="text-slate-400 mb-4 sm:mb-6 text-sm sm:text-base text-center">
                {lang === 'zh' ? '其他玩家仍在游戏中' : 'Other players are still playing'}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
                <button
                  onClick={handleRespawn}
                  className="px-6 sm:px-8 py-2 sm:py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-full transition-all animate-pulse text-sm sm:text-base"
                >
                  {lang === 'zh' ? '重新加入' : 'Respawn'}
                </button>
                <button
                  onClick={handleBackToLobby}
                  className="px-6 sm:px-8 py-2 sm:py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-full transition-all text-sm sm:text-base"
                >
                  {lang === 'zh' ? '返回大厅' : 'Back to Lobby'}
                </button>
              </div>
            </div>
          )}

          {/* 结算界面 - 时间结束时显示 */}
          {showResult && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-50 p-4 overflow-auto">
              <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500 mb-4 shrink-0">
                {lang === 'zh' ? '🏆 游戏结束 🏆' : '🏆 Game Over 🏆'}
              </h2>

              <div className="w-full max-w-sm bg-slate-800/50 rounded-xl p-3 sm:p-4 mb-4 shrink-0 max-h-[50vh] overflow-auto">
                <h3 className="text-center text-sm font-bold text-slate-300 mb-2">
                  {lang === 'zh' ? '最终排名' : 'Final Rankings'}
                </h3>
                <div className="space-y-1">
                  {finalLeaderboard.slice(0, 8).map((entry, idx) => (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between p-1.5 sm:p-2 rounded-lg text-sm ${entry.id === playerId ? 'bg-cyan-500/30 border border-cyan-500/50' :
                        idx < 3 ? 'bg-yellow-500/10' : 'bg-slate-700/50'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full ${idx === 0 ? 'bg-yellow-400 text-black' :
                          idx === 1 ? 'bg-slate-300 text-black' :
                            idx === 2 ? 'bg-amber-600 text-white' :
                              'bg-slate-600 text-slate-300'
                          }`}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                        </span>
                        <span className={`text-xs sm:text-sm ${entry.id === playerId ? 'text-cyan-300 font-bold' : 'text-white'}`}>
                          {entry.name}
                          {entry.id === playerId && <span className="text-xs text-cyan-400 ml-1">({lang === 'zh' ? '你' : 'You'})</span>}
                        </span>
                      </div>
                      <span className="font-mono text-xs sm:text-sm font-bold text-slate-300">{entry.mass}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
                <button
                  onClick={handlePlayAgain}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-bold rounded-full transition-all shadow-lg text-sm"
                >
                  {lang === 'zh' ? '🔄 再来一局' : '🔄 Play Again'}
                </button>
                <button
                  onClick={handleBackToLobby}
                  className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-full transition-all text-sm"
                >
                  {lang === 'zh' ? '离开房间' : 'Leave Room'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <ArchitectureDocs isOpen={isDocsOpen} onClose={() => setIsDocsOpen(false)} lang={lang} />
      <OperationGuide isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} lang={lang} />
    </div>
  );
}
