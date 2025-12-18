import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { ClientMessage, ServerMessage, PlayerInput, GameStateSnapshot, RoomPlayer, LeaderboardEntry } from './protocol';

// 根据当前页面协议自动选择服务器地址
const getServerUrl = () => {
  // 本地开发
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return 'http://localhost:3005';
  }
  // 生产环境 - 通过 Nginx 反向代理，使用相同域名（不需要端口）
  // Nginx 会将 /socket.io/ 请求代理到后端 3005 端口
  return `${location.protocol}//${location.host}`;
};

const SERVER_URL = getServerUrl();

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface SocketCallbacks {
  onConnectionChange?: (status: ConnectionStatus) => void;
  onRoomCreated?: (roomCode: string, playerId: string) => void;
  onRoomJoined?: (roomCode: string, playerId: string, players: RoomPlayer[], controlMode: 'gesture' | 'button') => void;
  onPlayerJoined?: (player: RoomPlayer) => void;
  onPlayerLeft?: (playerId: string) => void;
  onGameStarting?: (countdown: number) => void;
  onGameStarted?: () => void;
  onGameState?: (state: GameStateSnapshot) => void;
  onTimeUpdate?: (remainingSeconds: number) => void;
  onPlayerDied?: (playerId: string) => void;
  onGameOver?: (winner: string) => void;
  onGameEnded?: (leaderboard: LeaderboardEntry[]) => void;
  onPingUpdate?: (ping: number) => void;
  onError?: (message: string) => void;
  onLeaderboardUpdate?: (leaderboard: any[]) => void;
}

class GameSocket {
  private socket: Socket | null = null;
  private pingInterval: number | null = null;
  private currentPing: number = 0;
  private callbacks: SocketCallbacks = {};
  private status: ConnectionStatus = 'disconnected';

  connect(callbacks: SocketCallbacks): void {
    // 合并回调（允许多处注册）
    this.callbacks = { ...this.callbacks, ...callbacks };

    // 如果已连接，直接通知状态和当前延迟
    if (this.socket?.connected) {
      callbacks.onConnectionChange?.('connected');
      callbacks.onPingUpdate?.(this.currentPing);
      // 确保 ping 在运行
      if (this.pingInterval === null) {
        this.startPing();
      }
      return;
    }

    // 如果正在连接中，只更新回调
    if (this.socket) {
      callbacks.onConnectionChange?.(this.status);
      return;
    }

    this.status = 'connecting';
    callbacks.onConnectionChange?.('connecting');

    this.socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      this.status = 'connected';
      this.callbacks.onConnectionChange?.('connected');
      console.log('Connected to server');
      // 启动 ping 测量
      this.startPing();
    });

    this.socket.on('disconnect', () => {
      this.status = 'disconnected';
      this.callbacks.onConnectionChange?.('disconnected');
      console.log('Disconnected from server');
      // 停止 ping 测量
      this.stopPing();
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.callbacks.onError?.('无法连接到服务器');
    });

    this.socket.on('message', (msg: ServerMessage) => {
      this.handleMessage(msg);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.status = 'disconnected';
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'room_created':
        this.callbacks.onRoomCreated?.(msg.roomCode, msg.playerId);
        break;
      case 'room_joined':
        this.callbacks.onRoomJoined?.(msg.roomCode, msg.playerId, msg.players, msg.controlMode);
        break;
      case 'player_joined':
        this.callbacks.onPlayerJoined?.(msg.player);
        break;
      case 'player_left':
        this.callbacks.onPlayerLeft?.(msg.playerId);
        break;
      case 'game_starting':
        this.callbacks.onGameStarting?.(msg.countdown);
        break;
      case 'game_started':
        this.callbacks.onGameStarted?.();
        break;
      case 'game_state':
        this.callbacks.onGameState?.(msg.state);
        break;
      case 'time_update':
        this.callbacks.onTimeUpdate?.(msg.remainingSeconds);
        break;
      case 'player_died':
        this.callbacks.onPlayerDied?.(msg.playerId);
        break;
      case 'game_over':
        this.callbacks.onGameOver?.(msg.winner);
        break;
      case 'game_ended':
        this.callbacks.onGameEnded?.(msg.leaderboard);
        break;
      case 'pong':
        this.currentPing = Date.now() - msg.timestamp;
        console.log('[Ping] Received pong, latency:', this.currentPing, 'ms');
        this.callbacks.onPingUpdate?.(this.currentPing);
        break;
      case 'error':
        this.callbacks.onError?.(msg.message);
        break;
    }
  }

  private startPing(): void {
    this.stopPing();
    console.log('[Ping] Starting ping measurement');
    // 延迟 100ms 后开始，确保连接稳定
    setTimeout(() => {
      // 立即测一次
      const ts = Date.now();
      console.log('[Ping] Sending ping, timestamp:', ts);
      this.send({ type: 'ping', timestamp: ts });
      // 每 2 秒测量一次延迟
      this.pingInterval = window.setInterval(() => {
        const ts2 = Date.now();
        console.log('[Ping] Sending ping, timestamp:', ts2);
        this.send({ type: 'ping', timestamp: ts2 });
      }, 2000);
    }, 100);
  }

  private stopPing(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  getPing(): number {
    return this.currentPing;
  }

  private send(msg: ClientMessage): void {
    if (this.socket?.connected) {
      this.socket.emit('message', msg);
    } else {
      console.log('[Send] Socket not connected, message dropped:', msg.type);
    }
  }

  // 公开 API
  createRoom(playerName: string, gameDuration?: number, controlMode?: 'gesture' | 'button'): void {
    this.send({ type: 'create_room', playerName, gameDuration, controlMode });
  }

  joinRoom(roomCode: string, playerName: string): void {
    this.send({ type: 'join_room', roomCode, playerName });
  }

  rejoinRoom(roomCode: string): void {
    this.send({ type: 'rejoin_room', roomCode });
  }

  leaveRoom(): void {
    this.send({ type: 'leave_room' });
  }

  startGame(): void {
    this.send({ type: 'start_game' });
  }

  sendInput(input: PlayerInput): void {
    this.send({ type: 'input', input });
  }

  respawn(): void {
    this.send({ type: 'respawn' });
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// 单例导出
export const gameSocket = new GameSocket();
