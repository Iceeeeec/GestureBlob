import { Server, Socket } from 'socket.io';
import { GameEngine } from './GameEngine.js';
import { RoomPlayer, RoomState, PlayerInput, ServerMessage } from './types.js';

const TICK_RATE = 60;           // 服务端逻辑更新频率
const BROADCAST_RATE = 30;      // 状态广播频率 (提高到30fps)
const MAX_PLAYERS = 4;
const COUNTDOWN_SECONDS = 3;
const DEFAULT_GAME_DURATION = 300; // 默认游戏时长 5 分钟

export class Room {
  public code: string;
  public players: Map<string, RoomPlayer> = new Map();
  public status: 'waiting' | 'playing' | 'finished' = 'waiting';
  public hostId: string = '';

  private io: Server;
  private engine: GameEngine | null = null;
  private tickInterval: NodeJS.Timeout | null = null;
  private broadcastInterval: NodeJS.Timeout | null = null;
  private timeInterval: NodeJS.Timeout | null = null;
  private sockets: Map<string, Socket> = new Map();
  private deadNotified: Set<string> = new Set();
  private gameDuration: number;
  private remainingTime: number;

  constructor(io: Server, code: string, gameDuration?: number) {
    this.io = io;
    this.code = code;
    this.gameDuration = gameDuration || DEFAULT_GAME_DURATION;
    this.remainingTime = this.gameDuration;
  }

  addPlayer(socket: Socket, name: string): boolean {
    if (this.players.size >= MAX_PLAYERS) {
      return false;
    }

    if (this.status !== 'waiting') {
      return false;
    }

    const isHost = this.players.size === 0;
    const player: RoomPlayer = {
      id: socket.id,
      name,
      isHost,
      isReady: false
    };

    if (isHost) {
      this.hostId = socket.id;
    }

    this.players.set(socket.id, player);
    this.sockets.set(socket.id, socket);
    socket.join(this.code);

    return true;
  }

  removePlayer(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) return false;

    this.players.delete(playerId);
    this.sockets.delete(playerId);

    // 如果是房主离开，转移房主
    if (player.isHost && this.players.size > 0) {
      const newHost = this.players.values().next().value;
      if (newHost) {
        newHost.isHost = true;
        this.hostId = newHost.id;
      }
    }

    // 通知其他玩家
    this.broadcast({ type: 'player_left', playerId });

    // 如果游戏中，从引擎移除
    if (this.engine) {
      this.engine.removePlayer(playerId);
    }

    return this.players.size === 0;
  }

  startGame(requesterId: string): boolean {
    if (requesterId !== this.hostId) {
      return false;
    }

    if (this.players.size < 1) {
      return false;
    }

    // 倒计时
    let countdown = COUNTDOWN_SECONDS;
    const countdownInterval = setInterval(() => {
      this.broadcast({ type: 'game_starting', countdown });
      countdown--;

      if (countdown < 0) {
        clearInterval(countdownInterval);
        this.beginGame();
      }
    }, 1000);

    return true;
  }

  private beginGame(): void {
    this.status = 'playing';
    this.engine = new GameEngine();
    this.remainingTime = this.gameDuration;
    this.deadNotified.clear();

    // 添加所有玩家到引擎
    this.players.forEach((player, id) => {
      this.engine!.addPlayer(id, player.name);
    });

    this.broadcast({ type: 'game_started' });
    // 立即发送初始时间
    this.broadcast({ type: 'time_update', remainingSeconds: this.remainingTime });

    // 启动游戏循环
    this.tickInterval = setInterval(() => {
      this.engine!.update();
      this.checkGameOver();
    }, 1000 / TICK_RATE);

    // 启动状态广播
    this.broadcastInterval = setInterval(() => {
      this.broadcastState();
    }, 1000 / BROADCAST_RATE);

    // 启动时间倒计时
    this.timeInterval = setInterval(() => {
      this.remainingTime--;
      this.broadcast({ type: 'time_update', remainingSeconds: this.remainingTime });

      if (this.remainingTime <= 0) {
        this.finishGame();
      }
    }, 1000);
  }

  processInput(playerId: string, input: PlayerInput): void {
    if (!this.engine || this.status !== 'playing') return;
    this.engine.processInput(playerId, input);
  }

  respawnPlayer(playerId: string): void {
    if (!this.engine || this.status !== 'playing') return;
    this.engine.respawnPlayer(playerId);
  }

  private broadcastState(): void {
    if (!this.engine) return;

    // Generate state once without player marking
    const baseState = this.engine.getState();

    // For each player, just mark their entry in the leaderboard
    this.sockets.forEach((socket, playerId) => {
      // Clone leaderboard and mark isPlayer for this recipient
      const leaderboard = baseState.leaderboard.map(entry => ({
        ...entry,
        isPlayer: entry.id === playerId
      }));

      // Send state with modified leaderboard
      socket.emit('message', {
        type: 'game_state',
        state: { ...baseState, leaderboard }
      } as ServerMessage);
    });
  }

  private checkGameOver(): void {
    if (!this.engine) return;

    // 检查每个玩家是否死亡，通知他们可以重生
    this.players.forEach((player, playerId) => {
      const isAlive = this.engine!.isPlayerAlive(playerId);

      if (!isAlive && !this.deadNotified.has(playerId)) {
        // 玩家刚死亡，发送通知
        this.deadNotified.add(playerId);
        const socket = this.sockets.get(playerId);
        if (socket) {
          socket.emit('message', {
            type: 'player_died',
            playerId
          } as ServerMessage);
        }
      } else if (isAlive && this.deadNotified.has(playerId)) {
        // 玩家已重生，清除死亡标记
        this.deadNotified.delete(playerId);
      }
    });
  }

  // 时间到，正常结束游戏
  private finishGame(): void {
    if (!this.engine) return;

    // 获取最终排名
    const finalLeaderboard = this.engine.getState().leaderboard;

    // 广播游戏结束和最终排名
    this.broadcast({ type: 'game_ended', leaderboard: finalLeaderboard });

    this.endGame();
  }

  private endGame(): void {
    this.status = 'finished';

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }

    if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }

    // 10秒后重置房间状态，让玩家看结算界面
    setTimeout(() => {
      this.status = 'waiting';
      this.engine = null;
      this.remainingTime = this.gameDuration;
    }, 10000);
  }

  private broadcast(message: ServerMessage): void {
    this.io.to(this.code).emit('message', message);
  }

  getState(): RoomState {
    return {
      code: this.code,
      players: Array.from(this.players.values()),
      status: this.status,
      hostId: this.hostId
    };
  }

  isEmpty(): boolean {
    return this.players.size === 0;
  }

  destroy(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.broadcastInterval) clearInterval(this.broadcastInterval);
    this.players.clear();
    this.sockets.clear();
  }
}
