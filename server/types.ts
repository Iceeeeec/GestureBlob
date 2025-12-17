// 服务端类型定义

export interface Point {
  x: number;
  y: number;
}

export interface BlobEntity {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  vx: number;
  vy: number;
  name?: string;
  mergeTimestamp?: number;
}

export interface PlayerState {
  id: string;
  name: string;
  blobs: BlobEntity[];
  color: string;
  isAlive: boolean;
}

export interface PlayerInput {
  angle: number;      // 移动方向
  throttle: number;   // 0-1 速度比例
  action: 'none' | 'eject' | 'split';
}

export interface FoodEntity {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  vx: number;
  vy: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  mass: number;
  isPlayer?: boolean;
}

export interface GameStateSnapshot {
  players: {
    id: string;
    name: string;
    blobs: BlobEntity[];
    color: string;
    isAlive: boolean;
  }[];
  foods: FoodEntity[];
  leaderboard: LeaderboardEntry[];
  timestamp: number;
}

// WebSocket 消息协议
export type ClientMessage =
  | { type: 'create_room'; playerName: string; gameDuration?: number }
  | { type: 'join_room'; roomCode: string; playerName: string }
  | { type: 'rejoin_room'; roomCode: string }
  | { type: 'leave_room' }
  | { type: 'start_game' }
  | { type: 'input'; input: PlayerInput }
  | { type: 'respawn' }
  | { type: 'ping'; timestamp: number };

export type ServerMessage =
  | { type: 'room_created'; roomCode: string; playerId: string }
  | { type: 'room_joined'; roomCode: string; playerId: string; players: RoomPlayer[] }
  | { type: 'player_joined'; player: RoomPlayer }
  | { type: 'player_left'; playerId: string }
  | { type: 'game_starting'; countdown: number }
  | { type: 'game_started' }
  | { type: 'game_state'; state: GameStateSnapshot }
  | { type: 'time_update'; remainingSeconds: number }
  | { type: 'player_died'; playerId: string }
  | { type: 'game_over'; winner: string }
  | { type: 'game_ended'; leaderboard: LeaderboardEntry[] }
  | { type: 'pong'; timestamp: number }
  | { type: 'error'; message: string };

export interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
}

export interface RoomState {
  code: string;
  players: RoomPlayer[];
  status: 'waiting' | 'playing' | 'finished';
  hostId: string;
}
