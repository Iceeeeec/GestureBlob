import React, { useState, useEffect } from 'react';
import { gameSocket, ConnectionStatus } from '../network/socket';
import { RoomPlayer } from '../network/protocol';
import { Language } from '../types';
import { translations } from '../i18n';

interface LobbyProps {
  lang: Language;
  onGameStart: (playerId: string, roomCode: string, isHost: boolean, playerName: string, controlMode: 'gesture' | 'button') => void;
  // 用于从结算界面返回房间
  initialRoomState?: {
    roomCode: string;
    playerId: string;
    isHost: boolean;
    playerName: string;
  };
}

// 游戏时长选项（秒）
const DURATION_OPTIONS = [
  { value: 60, label: { zh: '1 分钟', en: '1 min' } },
  { value: 180, label: { zh: '3 分钟', en: '3 min' } },
  { value: 300, label: { zh: '5 分钟', en: '5 min' } },
  { value: 600, label: { zh: '10 分钟', en: '10 min' } },
];

export const Lobby: React.FC<LobbyProps> = ({ lang, onGameStart, initialRoomState }) => {
  const [view, setView] = useState<'menu' | 'create' | 'join' | 'room'>(initialRoomState ? 'room' : 'menu');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [playerId, setPlayerId] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [gameDuration, setGameDuration] = useState(300); // 默认 5 分钟
  const [controlMode, setControlMode] = useState<'gesture' | 'button'>('gesture');

  // 用 ref 保存最新值，供回调使用
  const playerIdRef = React.useRef('');
  const roomCodeRef = React.useRef('');
  const playerNameRef = React.useRef('');
  const isHostRef = React.useRef(false);
  const controlModeRef = React.useRef<'gesture' | 'button'>('gesture');

  // 同步 controlMode state 到 ref，确保回调中使用最新值
  React.useEffect(() => {
    controlModeRef.current = controlMode;
  }, [controlMode]);

  const t = translations[lang];

  // 处理从结算界面返回房间的情况
  useEffect(() => {
    if (initialRoomState) {
      setRoomCode(initialRoomState.roomCode);
      setPlayerId(initialRoomState.playerId);
      setIsHost(initialRoomState.isHost);
      setPlayerName(initialRoomState.playerName);
      roomCodeRef.current = initialRoomState.roomCode;
      playerIdRef.current = initialRoomState.playerId;
      isHostRef.current = initialRoomState.isHost;
      playerNameRef.current = initialRoomState.playerName;
      // 临时显示自己，等服务端返回完整列表
      setPlayers([{
        id: initialRoomState.playerId,
        name: initialRoomState.playerName,
        isHost: initialRoomState.isHost,
        isReady: false
      }]);
      setView('room');
      // 向服务端请求同步房间状态
      gameSocket.rejoinRoom(initialRoomState.roomCode);
    }
  }, [initialRoomState]);

  useEffect(() => {
    // 连接服务器
    gameSocket.connect({
      onConnectionChange: (status) => {
        setConnectionStatus(status);
        if (status === 'disconnected') {
          setView('menu');
          setError('与服务器断开连接');
        }
      },
      onRoomCreated: (code, id) => {
        setRoomCode(code);
        setPlayerId(id);
        roomCodeRef.current = code;
        playerIdRef.current = id;
        setIsHost(true);
        isHostRef.current = true;
        // Host uses the selected mode (from ref to avoid stale closure)
        // controlModeRef is already in sync via useEffect
        setPlayers([{ id, name: playerNameRef.current, isHost: true, isReady: false }]);
        setView('room');
        setError('');
      },
      onRoomJoined: (code, id, playerList, mode) => {
        setRoomCode(code);
        setPlayerId(id);
        roomCodeRef.current = code;
        playerIdRef.current = id;
        // 从玩家列表中检查自己是否是房主
        const me = playerList.find(p => p.id === id);
        const amIHost = me?.isHost ?? false;
        setIsHost(amIHost);
        isHostRef.current = amIHost;
        // Joiner uses the room mode
        controlModeRef.current = mode;
        setPlayers(playerList);
        setView('room');
        setError('');
      },
      onPlayerJoined: (player) => {
        setPlayers(prev => [...prev, player]);
      },
      onPlayerLeft: (leftId) => {
        setPlayers(prev => {
          const updated = prev.filter(p => p.id !== leftId);
          // 检查是否成为新房主
          const me = updated.find(p => p.id === playerId);
          if (me?.isHost) {
            setIsHost(true);
          }
          return updated;
        });
      },
      onGameStarting: (count) => {
        setCountdown(count);
      },
      onGameStarted: () => {
        setCountdown(null);
        onGameStart(playerIdRef.current, roomCodeRef.current, isHostRef.current, playerNameRef.current, controlModeRef.current);
      },
      onError: (msg) => {
        setError(msg);
      }
    });

    // 注意：不要在这里 disconnect，因为游戏开始后还需要保持连接
    return () => {
      // gameSocket.disconnect();
    };
  }, []);

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setError('请输入昵称');
      return;
    }
    setError('');
    playerNameRef.current = playerName.trim();
    gameSocket.createRoom(playerName.trim(), gameDuration, controlMode);
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      setError('请输入昵称');
      return;
    }
    if (!inputRoomCode.trim()) {
      setError('请输入房间码');
      return;
    }
    setError('');
    playerNameRef.current = playerName.trim();
    gameSocket.joinRoom(inputRoomCode.trim().toUpperCase(), playerName.trim());
  };

  const handleLeaveRoom = () => {
    gameSocket.leaveRoom();
    setView('menu');
    setRoomCode('');
    setPlayers([]);
    setIsHost(false);
  };

  const handleStartGame = () => {
    if (players.length < 1) {
      setError('至少需要1名玩家');
      return;
    }
    gameSocket.startGame();
  };

  const renderMenu = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-2">
          {lang === 'zh' ? '你的昵称' : 'Your Name'}
        </label>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder={lang === 'zh' ? '输入昵称...' : 'Enter name...'}
          maxLength={12}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => {
            if (!playerName.trim()) {
              setError(lang === 'zh' ? '请先输入昵称' : 'Please enter a name first');
              return;
            }
            setError('');
            setView('create');
          }}
          disabled={connectionStatus !== 'connected'}
          className="px-6 py-4 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all transform hover:scale-105 active:scale-95"
        >
          <div className="text-2xl mb-1">🏠</div>
          {lang === 'zh' ? '创建房间' : 'Create Room'}
        </button>
        <button
          onClick={() => {
            if (!playerName.trim()) {
              setError(lang === 'zh' ? '请先输入昵称' : 'Please enter a name first');
              return;
            }
            setError('');
            setView('join');
          }}
          disabled={connectionStatus !== 'connected'}
          className="px-6 py-4 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all transform hover:scale-105 active:scale-95"
        >
          <div className="text-2xl mb-1">🚪</div>
          {lang === 'zh' ? '加入房间' : 'Join Room'}
        </button>
      </div>

      {error && (
        <div className="text-rose-400 text-center text-sm">
          {error}
        </div>
      )}

      {connectionStatus === 'connecting' && (
        <div className="text-center text-slate-400">
          <div className="inline-block w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mr-2"></div>
          {lang === 'zh' ? '连接服务器中...' : 'Connecting...'}
        </div>
      )}

      {connectionStatus === 'disconnected' && (
        <div className="text-center text-rose-400">
          {lang === 'zh' ? '无法连接服务器，请确保服务器已启动' : 'Cannot connect to server'}
        </div>
      )}
    </div>
  );

  const renderCreate = () => (
    <div className="space-y-6">
      <button
        onClick={() => setView('menu')}
        className="text-slate-400 hover:text-white transition-colors"
      >
        ← {lang === 'zh' ? '返回' : 'Back'}
      </button>

      <div className="text-center">
        <h3 className="text-xl font-bold text-white mb-2">
          {lang === 'zh' ? '创建房间' : 'Create Room'}
        </h3>
        <p className="text-slate-400 text-sm">
          {lang === 'zh' ? '创建后分享房间码给好友' : 'Share the room code with friends'}
        </p>
      </div>

      {/* 游戏时长选择 */}
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-2">
          {lang === 'zh' ? '游戏时长' : 'Game Duration'}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {DURATION_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => setGameDuration(option.value)}
              className={`px-4 py-3 rounded-xl font-medium transition-all ${gameDuration === option.value
                ? 'bg-cyan-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
            >
              {option.label[lang]}
            </button>
          ))}
        </div>
      </div>



      {/* 控制模式选择 */}
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-2">
          {lang === 'zh' ? '控制模式' : 'Control Mode'}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setControlMode('gesture')}
            className={`px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${controlMode === 'gesture'
              ? 'bg-cyan-500 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
          >
            <span>✋</span>
            {lang === 'zh' ? '手势控制' : 'Gesture'}
          </button>
          <button
            onClick={() => setControlMode('button')}
            className={`px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${controlMode === 'button'
              ? 'bg-emerald-500 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
          >
            <span>🕹️</span>
            {lang === 'zh' ? '按键控制' : 'Buttons'}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-rose-400 text-center text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleCreateRoom}
        className="w-full px-6 py-4 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-xl transition-all"
      >
        {lang === 'zh' ? '创建房间' : 'Create'}
      </button>
    </div >
  );

  const renderJoin = () => (
    <div className="space-y-6">
      <button
        onClick={() => setView('menu')}
        className="text-slate-400 hover:text-white transition-colors"
      >
        ← {lang === 'zh' ? '返回' : 'Back'}
      </button>

      <div className="text-center">
        <h3 className="text-xl font-bold text-white mb-2">
          {lang === 'zh' ? '加入房间' : 'Join Room'}
        </h3>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-400 mb-2">
          {lang === 'zh' ? '房间码' : 'Room Code'}
        </label>
        <input
          type="text"
          value={inputRoomCode}
          onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
          placeholder="XXXX"
          maxLength={4}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-center text-2xl font-mono tracking-widest placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
        />
      </div>

      {error && (
        <div className="text-rose-400 text-center text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleJoinRoom}
        className="w-full px-6 py-4 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl transition-all"
      >
        {lang === 'zh' ? '加入' : 'Join'}
      </button>
    </div>
  );

  const renderRoom = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={handleLeaveRoom}
          className="text-slate-400 hover:text-white transition-colors"
        >
          ← {lang === 'zh' ? '离开' : 'Leave'}
        </button>
        <div className="text-right">
          <div className="text-xs text-slate-500 uppercase">
            {lang === 'zh' ? '房间码' : 'Room Code'}
          </div>
          <div className="text-2xl font-mono font-bold text-cyan-400 tracking-widest">
            {roomCode}
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4">
        <h4 className="text-sm font-medium text-slate-400 mb-3">
          {lang === 'zh' ? `玩家 (${players.length}/4)` : `Players (${players.length}/4)`}
        </h4>
        <div className="space-y-2">
          {players.map((player) => (
            <div
              key={player.id}
              className={`flex items-center justify-between p-3 rounded-lg ${player.id === playerId ? 'bg-cyan-500/20 border border-cyan-500/30' : 'bg-slate-700/50'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-white font-bold">
                  {(player.name || '?')[0].toUpperCase()}
                </div>
                <span className={player.id === playerId ? 'text-cyan-300 font-bold' : 'text-white'}>
                  {player.name || 'Unknown'}
                  {player.id === playerId && <span className="text-xs text-slate-400 ml-2">({lang === 'zh' ? '你' : 'You'})</span>}
                </span>
              </div>
              {player.isHost && (
                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                  {lang === 'zh' ? '房主' : 'Host'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {countdown !== null ? (
        <div className="text-center py-8">
          <div className="text-6xl font-black text-cyan-400 animate-pulse">
            {countdown}
          </div>
          <div className="text-slate-400 mt-2">
            {lang === 'zh' ? '游戏即将开始...' : 'Game starting...'}
          </div>
        </div>
      ) : isHost ? (
        <button
          onClick={handleStartGame}
          className="w-full px-6 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-all animate-pulse"
        >
          {lang === 'zh' ? '开始游戏' : 'Start Game'}
        </button>
      ) : (
        <div className="text-center text-slate-400 py-4">
          {lang === 'zh' ? '等待房主开始游戏...' : 'Waiting for host to start...'}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            GestureBlob
          </h1>
          <p className="text-slate-500 mt-2">
            {lang === 'zh' ? '手势控制多人对战' : 'Gesture-controlled Multiplayer'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          {error && (
            <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-300 text-sm">
              {error}
            </div>
          )}

          {view === 'menu' && renderMenu()}
          {view === 'create' && renderCreate()}
          {view === 'join' && renderJoin()}
          {view === 'room' && renderRoom()}
        </div>

        {/* Connection Status */}
        <div className="mt-4 text-center">
          <span className={`inline-flex items-center gap-2 text-xs ${connectionStatus === 'connected' ? 'text-green-400' :
            connectionStatus === 'connecting' ? 'text-yellow-400' : 'text-rose-400'
            }`}>
            <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-400' :
              connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-rose-400'
              }`}></span>
            {connectionStatus === 'connected' ? (lang === 'zh' ? '已连接' : 'Connected') :
              connectionStatus === 'connecting' ? (lang === 'zh' ? '连接中' : 'Connecting') :
                (lang === 'zh' ? '未连接' : 'Disconnected')}
          </span>
        </div>
      </div>
    </div>
  );
};
