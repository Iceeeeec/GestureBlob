import React, { useState } from 'react';
import App from './App';
import AppOnline from './AppOnline';
import { Logo } from './components/Logo';

type GameMode = 'select' | 'single' | 'online';

export default function AppMain() {
  const [mode, setMode] = useState<GameMode>('select');

  if (mode === 'single') {
    return <App onBack={() => setMode('select')} />;
  }

  if (mode === 'online') {
    return <AppOnline onBack={() => setMode('select')} />;
  }

  // 模式选择界面
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="text-center mb-8 sm:mb-12">
        <Logo />
        <p className="text-slate-400 mt-2 text-sm sm:text-base">手势控制多人对战</p>
      </div>

      <div className="flex flex-col gap-3 sm:gap-4 w-full max-w-sm px-2">
        <button
          onClick={() => setMode('single')}
          className="w-full px-6 sm:px-8 py-5 sm:py-6 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold text-lg sm:text-xl rounded-2xl transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
        >
          <div className="flex items-center justify-center gap-3">
            <span className="text-xl sm:text-2xl">🎮</span>
            <span>单人模式</span>
          </div>
          <p className="text-xs sm:text-sm font-normal text-cyan-100 mt-1">与 AI 机器人对战</p>
        </button>

        <button
          onClick={() => setMode('online')}
          className="w-full px-6 sm:px-8 py-5 sm:py-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold text-lg sm:text-xl rounded-2xl transition-all shadow-lg shadow-purple-500/20 active:scale-95"
        >
          <div className="flex items-center justify-center gap-3">
            <span className="text-xl sm:text-2xl">🌐</span>
            <span>联机模式</span>
          </div>
          <p className="text-xs sm:text-sm font-normal text-purple-100 mt-1">创建或加入房间</p>
        </button>
      </div>

      <p className="text-slate-600 text-xs sm:text-sm mt-8 sm:mt-12">
        使用摄像头手势控制游戏
      </p>
    </div>
  );
}
