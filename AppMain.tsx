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
      <div className="text-center mb-6 sm:mb-8">
        <Logo />
        <p className="text-slate-400 mt-2 text-sm sm:text-base">手势控制多人对战</p>
      </div>

      {/* 操作指南 - 直接显示在首页 */}
      <div className="w-full max-w-md mb-6 sm:mb-8 px-2">
        <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
          <h3 className="text-white font-bold text-center mb-3 text-sm sm:text-base">🎮 操作指南</h3>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-slate-800/50 rounded-xl p-2 sm:p-3 text-center">
              <div className="text-2xl sm:text-3xl mb-1">✊</div>
              <div className="text-cyan-400 font-bold text-xs sm:text-sm">握拳</div>
              <div className="text-slate-500 text-[10px] sm:text-xs">移动</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-2 sm:p-3 text-center">
              <div className="text-2xl sm:text-3xl mb-1">✌️</div>
              <div className="text-yellow-400 font-bold text-xs sm:text-sm">剪刀手</div>
              <div className="text-slate-500 text-[10px] sm:text-xs">分裂</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-2 sm:p-3 text-center">
              <div className="text-2xl sm:text-3xl mb-1">🖐️</div>
              <div className="text-rose-400 font-bold text-xs sm:text-sm">张开手</div>
              <div className="text-slate-500 text-[10px] sm:text-xs">吐孢子</div>
            </div>
          </div>
        </div>
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

      <p className="text-slate-600 text-xs sm:text-sm mt-6 sm:mt-8">
        使用摄像头手势控制游戏
      </p>
    </div>
  );
}
