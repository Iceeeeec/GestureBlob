
export interface Point {
  x: number;
  y: number;
}

export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export interface BlobEntity {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  vx: number;
  vy: number;
  isBot?: boolean;
  name?: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export enum GameStatus {
  IDLE = 'IDLE',
  LOADING_MODEL = 'LOADING_MODEL',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export interface GameState {
  score: number;
  status: GameStatus;
  highScore: number;
}
