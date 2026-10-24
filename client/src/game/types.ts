import type { GestureType } from '@motion-game/protocol';

export type GameState = 'START' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

export type PlayerPosture = 'RUNNING' | 'JUMPING' | 'SLIDING' | 'HIT';

export type Lane = 0 | 1 | 2; // 0: Left, 1: Center, 2: Right

export type ObstacleType = 'HURDLE' | 'OVERHEAD_LASER' | 'LANE_BARRIER' | 'ENERGY_ORB';

export interface Obstacle {
  id: number;
  type: ObstacleType;
  x: number;
  y: number;
  width: number;
  height: number;
  lane: Lane;
  passed: boolean;
  collected?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface GameStats {
  score: number;
  highScore: number;
  distance: number;
  coins: number;
  multiplier: number;
  lives: number;
  speed: number;
}
