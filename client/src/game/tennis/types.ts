export type TennisGameState = 'SERVE_PLAYER' | 'SERVE_AI' | 'RALLY' | 'POINT_WON' | 'GAME_OVER';

export type ShotType = 'DRIVE' | 'SMASH' | 'SLICE' | 'SERVE';

export interface TennisPointScore {
  player: number; // 0=Love, 1=15, 2=30, 3=40, 4=Game/Adv
  ai: number;
  playerGames: number;
  aiGames: number;
  isDeuce: boolean;
  advantage: 'player' | 'ai' | null;
}

export interface TennisStats {
  scoreText: string;
  gameScoreText: string;
  rallyCount: number;
  bestRally: number;
  playerGames: number;
  aiGames: number;
  lastShotType: string | null;
  server: 'player' | 'ai';
}

export interface Ball {
  x: number;
  y: number;
  z: number; // height off court
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  spin: number;
  lastHitter: 'player' | 'ai' | null;
  bouncesSinceHit: number;
  inPlay: boolean;
  trail: { x: number; y: number; z: number; alpha: number }[];
}

export interface PlayerPaddle {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  targetX: number;
  racketAngle: number;
  swingProgress: number; // 0 to 1
  isSwinging: boolean;
  swingType: ShotType;
}

export interface CourtBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  netY: number;
  serviceTopY: number;
  serviceBottomY: number;
  centerServiceX: number;
}

export interface TennisParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  alpha: number;
  scale: number;
  life: number;
  maxLife: number;
}
