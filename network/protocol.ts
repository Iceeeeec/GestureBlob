// 前端网络协议类型定义（与服务端 types.ts 保持同步）

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

export interface PlayerInput {
  angle: number;
  throttle: number;
  action: 'none' | 'eject' | 'split';
  // For split action: world coordinates of hand position
  splitTargetX?: number;
  splitTargetY?: number;
  // For eject action: world coordinates of hand position
  ejectTargetX?: number;
  ejectTargetY?: number;
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

export interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
}

// 客户端发送的消息
export type ClientMessage =
  | { type: 'create_room'; playerName: string; gameDuration?: number }
  | { type: 'join_room'; roomCode: string; playerName: string }
  | { type: 'rejoin_room'; roomCode: string }
  | { type: 'leave_room' }
  | { type: 'start_game' }
  | { type: 'input'; input: PlayerInput }
  | { type: 'respawn' }
  | { type: 'ping'; timestamp: number };

// 服务端发送的消息
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
