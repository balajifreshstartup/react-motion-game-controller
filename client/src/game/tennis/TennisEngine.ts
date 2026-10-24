import confetti from 'canvas-confetti';
import type { GestureType } from '@motion-game/protocol';
import { tennisAudio } from './tennisAudio.js';
import type {
  Ball,
  CourtBounds,
  FloatingText,
  PlayerPaddle,
  ShotType,
  TennisGameState,
  TennisParticle,
  TennisPointScore,
  TennisStats,
} from './types.js';

export interface TennisEngineCallbacks {
  onStatsUpdate: (stats: TennisStats) => void;
  onStateChange: (state: TennisGameState) => void;
  onFeedback: (text: string) => void;
}

export class TennisEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: TennisEngineCallbacks;

  private state: TennisGameState = 'SERVE_PLAYER';
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  private isDestroyed = false;

  // Ball
  private ball: Ball = {
    x: 400,
    y: 480,
    z: 25,
    vx: 0,
    vy: 0,
    vz: 0,
    radius: 7,
    spin: 0,
    lastHitter: null,
    bouncesSinceHit: 0,
    inPlay: false,
    trail: [],
  };

  // Player (Bottom)
  private player: PlayerPaddle = {
    x: 400,
    y: 530,
    width: 44,
    height: 18,
    speed: 460,
    targetX: 400,
    racketAngle: 0,
    swingProgress: 0,
    isSwinging: false,
    swingType: 'DRIVE',
  };

  // AI Opponent (Top)
  private ai: PlayerPaddle = {
    x: 400,
    y: 110,
    width: 42,
    height: 18,
    speed: 380,
    targetX: 400,
    racketAngle: 0,
    swingProgress: 0,
    isSwinging: false,
    swingType: 'DRIVE',
  };

  // Score
  private score: TennisPointScore = {
    player: 0,
    ai: 0,
    playerGames: 0,
    aiGames: 0,
    isDeuce: false,
    advantage: null,
  };

  private currentRally = 0;
  private bestRally = 0;
  private server: 'player' | 'ai' = 'player';
  private lastShotType: string | null = null;

  // Particles & Visual FX
  private particles: TennisParticle[] = [];
  private floatingTexts: FloatingText[] = [];
  private screenShake = 0;

  // Court Geometry
  private court: CourtBounds = {
    left: 180,
    right: 620,
    top: 90,
    bottom: 550,
    netY: 320,
    serviceTopY: 205,
    serviceBottomY: 435,
    centerServiceX: 400,
  };

  // Input states
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private keysPressed: Record<string, boolean> = {};

  constructor(canvas: HTMLCanvasElement, callbacks: TennisEngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to acquire 2D canvas context for Tennis');
    }
    this.ctx = context;
    this.callbacks = callbacks;

    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.boundKeyDown);
      window.addEventListener('keyup', this.boundKeyUp);
    }

    this.resizeCanvas();
    this.resetForServe('player');
  }

  public resizeCanvas(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect() || { width: 800, height: 640 };
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);

    // Update court geometry based on actual width/height
    const w = rect.width;
    const h = rect.height;

    const courtWidth = Math.min(w * 0.72, 480);
    const courtHeight = h * 0.78;

    this.court = {
      left: (w - courtWidth) / 2,
      right: (w + courtWidth) / 2,
      top: h * 0.11,
      bottom: h * 0.11 + courtHeight,
      netY: h * 0.11 + courtHeight / 2,
      serviceTopY: h * 0.11 + courtHeight * 0.25,
      serviceBottomY: h * 0.11 + courtHeight * 0.75,
      centerServiceX: w / 2,
    };

    this.player.y = this.court.bottom - 15;
    this.ai.y = this.court.top + 15;
  }

  public start(): void {
    if (this.animationFrameId) return;
    this.lastFrameTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundKeyDown);
      window.removeEventListener('keyup', this.boundKeyUp);
    }
  }

  // --- External Input Handlers (WebSocket & Motions) ---

  public handleTilt(tiltX: number, _tiltY: number): void {
    // Map tiltX (-1 to 1) across the player's baseline
    const courtWidth = this.court.right - this.court.left;
    const padding = 20;
    const minX = this.court.left - padding;
    const maxX = this.court.right + padding;

    const target = this.court.centerServiceX + tiltX * (courtWidth / 2 + padding);
    this.player.targetX = Math.max(minX, Math.min(maxX, target));
  }

  public handleGesture(gesture: GestureType): void {
    switch (gesture) {
      case 'jump':
        // Flick up / Jump = Power Smash
        this.attemptPlayerSwing('SMASH');
        break;
      case 'squat':
        // Flick down / Squat = Slice / Drop Shot
        this.attemptPlayerSwing('SLICE');
        break;
      case 'left':
        this.player.targetX -= 55;
        break;
      case 'right':
        this.player.targetX += 55;
        break;
      case 'neutral':
        this.attemptPlayerSwing('DRIVE');
        break;
    }
  }

  public triggerServeOrSwing(): void {
    if (this.state === 'SERVE_PLAYER') {
      this.serveBall('player');
    } else if (this.state === 'RALLY') {
      this.attemptPlayerSwing('DRIVE');
    } else if (this.state === 'POINT_WON' || this.state === 'GAME_OVER') {
      this.resetForServe(this.server);
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    this.keysPressed[e.code] = true;

    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      this.triggerServeOrSwing();
    } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      this.attemptPlayerSwing('SMASH');
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      this.attemptPlayerSwing('SLICE');
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keysPressed[e.code] = false;
  }

  // --- Serve & Rallies ---

  private resetForServe(server: 'player' | 'ai'): void {
    this.server = server;
    this.state = server === 'player' ? 'SERVE_PLAYER' : 'SERVE_AI';
    this.ball.inPlay = false;
    this.ball.lastHitter = null;
    this.ball.bouncesSinceHit = 0;
    this.ball.trail = [];

    if (server === 'player') {
      this.ball.x = this.player.x + 12;
      this.ball.y = this.player.y - 12;
      this.ball.z = 24;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.ball.vz = 0;
    } else {
      this.ball.x = this.ai.x - 12;
      this.ball.y = this.ai.y + 12;
      this.ball.z = 24;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.ball.vz = 0;
      // Auto-serve AI after brief delay
      setTimeout(() => {
        if (!this.isDestroyed && this.state === 'SERVE_AI') {
          this.serveBall('ai');
        }
      }, 900);
    }

    this.dispatchStats();
    this.callbacks.onStateChange(this.state);
  }

  private serveBall(server: 'player' | 'ai'): void {
    this.state = 'RALLY';
    this.ball.inPlay = true;
    this.ball.lastHitter = server;
    this.ball.bouncesSinceHit = 0;
    this.currentRally = 1;

    tennisAudio.playHit('SERVE');
    this.addFloatingText(server === 'player' ? 'PLAYER SERVE!' : 'ACE SERVE!', this.ball.x, this.ball.y, '#38bdf8');

    if (server === 'player') {
      this.player.isSwinging = true;
      this.player.swingProgress = 0;
      this.player.swingType = 'SERVE';

      // Cross-court diagonally into AI service box
      const targetX = this.court.centerServiceX + (Math.random() - 0.5) * 140;
      const targetY = this.court.serviceTopY + 30;
      const distY = targetY - this.ball.y;
      const speedY = -420;
      const time = distY / speedY;

      this.ball.vy = speedY;
      this.ball.vx = (targetX - this.ball.x) / time;
      this.ball.vz = 3.6;
    } else {
      this.ai.isSwinging = true;
      this.ai.swingProgress = 0;
      this.ai.swingType = 'SERVE';

      const targetX = this.court.centerServiceX + (Math.random() - 0.5) * 140;
      const targetY = this.court.serviceBottomY - 30;
      const distY = targetY - this.ball.y;
      const speedY = 380;
      const time = distY / speedY;

      this.ball.vy = speedY;
      this.ball.vx = (targetX - this.ball.x) / time;
      this.ball.vz = 3.4;
    }

    this.dispatchStats();
  }

  // --- Swing & Hit Detection ---

  private attemptPlayerSwing(type: ShotType): void {
    this.player.isSwinging = true;
    this.player.swingProgress = 0;
    this.player.swingType = type;

    if (this.state === 'SERVE_PLAYER') {
      this.serveBall('player');
      return;
    }

    if (this.state !== 'RALLY') return;

    // Check hit radius to ball
    const dx = this.ball.x - this.player.x;
    const dy = this.ball.y - this.player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Hit box allows reaching within 65px radius when ball is playable height
    if (dist < 68 && this.ball.z < 65 && this.ball.vy > 0) {
      this.hitBall('player', type);
    }
  }

  private hitBall(hitter: 'player' | 'ai', type: ShotType): void {
    this.ball.lastHitter = hitter;
    this.ball.bouncesSinceHit = 0;
    this.currentRally++;
    if (this.currentRally > this.bestRally) this.bestRally = this.currentRally;
    this.lastShotType = type;

    // Audio & Particles
    tennisAudio.playHit(type);
    this.createHitParticles(this.ball.x, this.ball.y, type);

    let speedY = hitter === 'player' ? -520 : 460;
    let vz = 4.2;
    let targetX = hitter === 'player' ? this.court.left + Math.random() * (this.court.right - this.court.left) : this.player.x;

    if (type === 'SMASH') {
      speedY = hitter === 'player' ? -680 : 560;
      vz = 2.4; // flat high-velocity cannon
      this.screenShake = 6;
      this.addFloatingText('POWER SMASH! 🔥', this.ball.x, this.ball.y, '#f59e0b');
    } else if (type === 'SLICE') {
      speedY = hitter === 'player' ? -380 : 340;
      vz = 5.2; // high arc, drops short
      this.addFloatingText('NICE SLICE! 🎾', this.ball.x, this.ball.y, '#a855f7');
    } else {
      if (Math.abs(this.ball.x - (hitter === 'player' ? this.player.x : this.ai.x)) < 15) {
        this.addFloatingText('SWEET SPOT! ✨', this.ball.x, this.ball.y, '#38bdf8');
      }
    }

    // Directional angling based on hit offset from racket center
    const hitterX = hitter === 'player' ? this.player.x : this.ai.x;
    const offset = (this.ball.x - hitterX) / 30; // -1 to 1
    const angleX = offset * 220;

    this.ball.vy = speedY;
    this.ball.vx = angleX;
    this.ball.vz = vz;

    this.dispatchStats();
  }

  // --- Point Resolution & Scoring ---

  private awardPoint(winner: 'player' | 'ai', reason: string): void {
    if (this.state === 'POINT_WON' || this.state === 'GAME_OVER') return;

    this.state = 'POINT_WON';
    this.callbacks.onStateChange(this.state);

    if (winner === 'player') {
      tennisAudio.playPointWon();
      this.addFloatingText(`POINT PLAYER! (${reason})`, 400, 320, '#10b981');
    } else {
      tennisAudio.playPointLost();
      this.addFloatingText(`POINT BOT! (${reason})`, 400, 320, '#ef4444');
    }

    // Update Tennis Point Score
    this.updateTennisScore(winner);

    // Auto next point after 1.8s
    setTimeout(() => {
      if (!this.isDestroyed && this.state === 'POINT_WON') {
        const nextServer = this.server === 'player' ? 'ai' : 'player';
        this.resetForServe(nextServer);
      }
    }, 1800);
  }

  private updateTennisScore(winner: 'player' | 'ai'): void {
    if (winner === 'player') {
      if (this.score.player === 3 && this.score.ai === 3) {
        // Deuce logic
        if (this.score.advantage === 'player') {
          this.winGame('player');
          return;
        } else if (this.score.advantage === 'ai') {
          this.score.advantage = null;
        } else {
          this.score.advantage = 'player';
        }
      } else if (this.score.player === 3 && this.score.ai < 3) {
        this.winGame('player');
        return;
      } else {
        this.score.player++;
      }
    } else {
      if (this.score.player === 3 && this.score.ai === 3) {
        if (this.score.advantage === 'ai') {
          this.winGame('ai');
          return;
        } else if (this.score.advantage === 'player') {
          this.score.advantage = null;
        } else {
          this.score.advantage = 'ai';
        }
      } else if (this.score.ai === 3 && this.score.player < 3) {
        this.winGame('ai');
        return;
      } else {
        this.score.ai++;
      }
    }

    this.dispatchStats();
  }

  private winGame(winner: 'player' | 'ai'): void {
    this.score.player = 0;
    this.score.ai = 0;
    this.score.advantage = null;

    if (winner === 'player') {
      this.score.playerGames++;
      this.addFloatingText('🏆 GAME TO PLAYER! 🏆', 400, 260, '#38bdf8');
      confetti({
        particleCount: 75,
        spread: 80,
        origin: { y: 0.6 },
      });
    } else {
      this.score.aiGames++;
      this.addFloatingText('GAME TO BOT!', 400, 260, '#f43f5e');
    }

    // Check Set Win (first to 3 games for mini-game)
    if (this.score.playerGames >= 3) {
      this.state = 'GAME_OVER';
      this.addFloatingText('MATCH WON! GRAND SLAM CHAMPION! 🥇', 400, 240, '#10b981');
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
      });
    } else if (this.score.aiGames >= 3) {
      this.state = 'GAME_OVER';
      this.addFloatingText('MATCH OVER! BOT WINS!', 400, 240, '#ef4444');
    }

    this.dispatchStats();
  }

  // --- Main Simulation Loop ---

  private gameLoop(timestamp: number): void {
    if (this.isDestroyed) return;

    const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = timestamp;

    this.update(dt);
    this.render();

    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
  }

  private update(dt: number): void {
    // 1. Player movement with keyboard
    if (this.keysPressed['ArrowLeft'] || this.keysPressed['KeyA']) {
      this.player.targetX -= this.player.speed * dt;
    }
    if (this.keysPressed['ArrowRight'] || this.keysPressed['KeyD']) {
      this.player.targetX += this.player.speed * dt;
    }

    // Clamp player within court limits
    const minX = this.court.left - 25;
    const maxX = this.court.right + 25;
    this.player.targetX = Math.max(minX, Math.min(maxX, this.player.targetX));
    this.player.x += (this.player.targetX - this.player.x) * 14 * dt;

    // Player swing animation
    if (this.player.isSwinging) {
      this.player.swingProgress += dt * 5.5;
      this.player.racketAngle = Math.sin(this.player.swingProgress * Math.PI) * 1.8;
      if (this.player.swingProgress >= 1) {
        this.player.isSwinging = false;
        this.player.swingProgress = 0;
        this.player.racketAngle = 0;
      }
    }

    // 2. AI Movement & Logic
    this.updateAI(dt);

    // 3. Ball Physics & Flight
    if (this.ball.inPlay) {
      this.updateBall(dt);
    }

    // 4. Update particles & floating texts
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.y -= 30 * dt;
      t.life -= dt;
      t.alpha = Math.max(0, t.life / t.maxLife);
      if (t.life <= 0) this.floatingTexts.splice(i, 1);
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }
  }

  private updateAI(dt: number): void {
    if (this.state === 'RALLY') {
      // Predict ball interception
      let targetX = this.ball.x;
      // Add slight human error
      if (this.ball.vy < 0) {
        targetX = this.ball.x + Math.sin(Date.now() / 300) * 12;
      } else {
        targetX = this.court.centerServiceX;
      }

      const minX = this.court.left - 20;
      const maxX = this.court.right + 20;
      targetX = Math.max(minX, Math.min(maxX, targetX));

      this.ai.targetX = targetX;
      this.ai.x += (this.ai.targetX - this.ai.x) * 10 * dt;

      // AI Swing when ball approaches AI baseline
      const dx = this.ball.x - this.ai.x;
      const dy = this.ball.y - this.ai.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 60 && this.ball.z < 65 && this.ball.vy < 0) {
        this.ai.isSwinging = true;
        this.ai.swingProgress = 0;
        const shotTypes: ShotType[] = ['DRIVE', 'DRIVE', 'SMASH', 'SLICE'];
        const chosen = shotTypes[Math.floor(Math.random() * shotTypes.length)];
        this.hitBall('ai', chosen);
      }
    }

    // AI swing animation
    if (this.ai.isSwinging) {
      this.ai.swingProgress += dt * 5.5;
      this.ai.racketAngle = -Math.sin(this.ai.swingProgress * Math.PI) * 1.8;
      if (this.ai.swingProgress >= 1) {
        this.ai.isSwinging = false;
        this.ai.swingProgress = 0;
        this.ai.racketAngle = 0;
      }
    }
  }

  private updateBall(dt: number): void {
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;
    this.ball.z += this.ball.vz;
    this.ball.vz -= 0.18; // gravity

    // Trail
    if (Math.abs(this.ball.vy) > 200) {
      this.ball.trail.push({ x: this.ball.x, y: this.ball.y, z: this.ball.z, alpha: 0.65 });
      if (this.ball.trail.length > 12) this.ball.trail.shift();
    } else {
      if (this.ball.trail.length > 0) this.ball.trail.shift();
    }

    // Net check
    const passedNet = (this.ball.y - this.court.netY) * (this.ball.y - this.ball.vy * dt - this.court.netY) <= 0;
    if (passedNet && this.ball.z < 18) {
      // Hit net!
      tennisAudio.playBounce();
      this.ball.vy *= -0.2;
      this.ball.vx *= 0.5;
      this.ball.vz = -0.1;
      this.awardPoint(this.ball.lastHitter === 'player' ? 'ai' : 'player', 'NET FAULT');
      return;
    }

    // Bounce on court
    if (this.ball.z <= 0) {
      this.ball.z = 0;
      this.ball.vz = -this.ball.vz * 0.72; // restitution
      this.ball.bouncesSinceHit++;

      tennisAudio.playBounce();
      this.createBounceRing(this.ball.x, this.ball.y);

      // Check In / Out
      const inCourt =
        this.ball.x >= this.court.left &&
        this.ball.x <= this.court.right &&
        this.ball.y >= this.court.top &&
        this.ball.y <= this.court.bottom;

      if (!inCourt) {
        // Out!
        this.awardPoint(this.ball.lastHitter === 'player' ? 'ai' : 'player', 'OUT OF BOUNDS');
        return;
      }

      // If bounced twice without being hit
      if (this.ball.bouncesSinceHit >= 2) {
        this.awardPoint(this.ball.lastHitter === 'player' ? 'player' : 'ai', 'DOUBLE BOUNCE');
        return;
      }
    }

    // Boundary check (off canvas)
    if (this.ball.y < 30 || this.ball.y > this.canvas.height + 40) {
      this.awardPoint(this.ball.lastHitter === 'player' ? 'player' : 'ai', 'MISSED');
    }
  }

  // --- Particle & Visual FX helpers ---

  private createHitParticles(x: number, y: number, type: ShotType): void {
    const color = type === 'SMASH' ? '#f59e0b' : type === 'SLICE' ? '#a855f7' : '#38bdf8';
    const count = type === 'SMASH' ? 24 : 14;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  private createBounceRing(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * 45,
        vy: Math.sin(angle) * 25, // oval perspective
        life: 0.28,
        maxLife: 0.28,
        color: '#e2e8f0',
        size: 2,
      });
    }
  }

  private addFloatingText(text: string, x: number, y: number, color: string): void {
    this.floatingTexts.push({
      id: `${Date.now()}-${Math.random()}`,
      text,
      x,
      y,
      color,
      alpha: 1,
      scale: 1,
      life: 1.2,
      maxLife: 1.2,
    });
    this.callbacks.onFeedback(text);
  }

  private dispatchStats(): void {
    const points = ['LOVE', '15', '30', '40'];
    let pScore = points[Math.min(this.score.player, 3)];
    let aScore = points[Math.min(this.score.ai, 3)];

    if (this.score.player >= 3 && this.score.ai >= 3) {
      if (this.score.advantage === 'player') {
        pScore = 'ADV';
        aScore = '40';
      } else if (this.score.advantage === 'ai') {
        pScore = '40';
        aScore = 'ADV';
      } else {
        pScore = 'DEUCE';
        aScore = 'DEUCE';
      }
    }

    const scoreText = `${pScore} - ${aScore}`;
    const gameScoreText = `GAMES: ${this.score.playerGames} - ${this.score.aiGames}`;

    this.callbacks.onStatsUpdate({
      scoreText,
      gameScoreText,
      rallyCount: this.currentRally,
      bestRally: this.bestRally,
      playerGames: this.score.playerGames,
      aiGames: this.score.aiGames,
      lastShotType: this.lastShotType,
      server: this.server,
    });
  }

  // --- Rendering ---

  private render(): void {
    const ctx = this.ctx;
    const w = parseFloat(this.canvas.style.width) || 800;
    const h = parseFloat(this.canvas.style.height) || 640;

    ctx.save();

    // Screen shake
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    // 1. Stadium Background & Night Atmosphere
    this.renderStadium(ctx, w, h);

    // 2. Tennis Court Lines & Surface
    this.renderCourt(ctx);

    // 3. Drop Shadows
    this.renderShadows(ctx);

    // 4. Net with 3D Depth
    this.renderNet(ctx);

    // 5. Players & Rackets
    this.renderPaddle(ctx, this.ai, 'ai');
    this.renderPaddle(ctx, this.player, 'player');

    // 6. Tennis Ball with 3D height & Glow
    this.renderBall(ctx);

    // 7. Particles & Shockwaves
    this.renderParticles(ctx);

    // 8. Floating Feedback Banners
    this.renderFloatingTexts(ctx);

    ctx.restore();
  }

  private renderStadium(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // Deep midnight gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(0.5, '#0d1527');
    bgGrad.addColorStop(1, '#080c14');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Stadium Grandstands with Crowd Silhouettes
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.rect(0, 0, w, this.court.top - 15);
    ctx.fill();

    // Crowd silhouettes
    ctx.fillStyle = '#1e293b';
    for (let x = 10; x < w; x += 18) {
      const headY = 25 + Math.sin(x * 0.1 + Date.now() / 1000) * 3;
      ctx.beginPath();
      ctx.arc(x, headY, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Stadium Floodlights in corners casting soft light beams
    const drawLight = (lx: number, ly: number, targetX: number, targetY: number) => {
      const grad = ctx.createRadialGradient(lx, ly, 10, targetX, targetY, 320);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
      grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.08)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(lx - 25, ly);
      ctx.lineTo(targetX + 160, targetY + 220);
      ctx.lineTo(targetX - 160, targetY + 220);
      ctx.closePath();
      ctx.fill();
    };

    drawLight(60, 20, w / 2, h / 2);
    drawLight(w - 60, 20, w / 2, h / 2);
  }

  private renderCourt(ctx: CanvasRenderingContext2D): void {
    const c = this.court;

    // Court Surface (Deep Cyber Royal Blue)
    const courtGrad = ctx.createLinearGradient(c.left, c.top, c.right, c.bottom);
    courtGrad.addColorStop(0, '#0f172a');
    courtGrad.addColorStop(0.5, '#1e293b');
    courtGrad.addColorStop(1, '#0f172a');

    ctx.fillStyle = courtGrad;
    ctx.fillRect(c.left, c.top, c.right - c.left, c.bottom - c.top);

    // Outer Court Boundary Glow
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(c.left, c.top, c.right - c.left, c.bottom - c.top);

    // Inner Singles Lines
    const singlesInset = (c.right - c.left) * 0.12;
    ctx.strokeStyle = 'rgba(241, 245, 249, 0.85)';
    ctx.lineWidth = 2;

    // Singles sidelines
    ctx.strokeRect(c.left + singlesInset, c.top, c.right - c.left - singlesInset * 2, c.bottom - c.top);

    // Service lines
    ctx.beginPath();
    ctx.moveTo(c.left + singlesInset, c.serviceTopY);
    ctx.lineTo(c.right - singlesInset, c.serviceTopY);

    ctx.moveTo(c.left + singlesInset, c.serviceBottomY);
    ctx.lineTo(c.right - singlesInset, c.serviceBottomY);

    // Center service line
    ctx.moveTo(c.centerServiceX, c.serviceTopY);
    ctx.lineTo(c.centerServiceX, c.serviceBottomY);

    // Baseline center marks
    ctx.moveTo(c.centerServiceX, c.top);
    ctx.lineTo(c.centerServiceX, c.top + 10);

    ctx.moveTo(c.centerServiceX, c.bottom);
    ctx.lineTo(c.centerServiceX, c.bottom - 10);
    ctx.stroke();
  }

  private renderNet(ctx: CanvasRenderingContext2D): void {
    const c = this.court;
    const netY = c.netY;

    // Net line with mesh styling
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    for (let x = c.left - 15; x <= c.right + 15; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, netY - 8);
      ctx.lineTo(x, netY + 4);
      ctx.stroke();
    }

    // Top Net White Tape
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(c.left - 15, netY);
    ctx.lineTo(c.right + 15, netY);
    ctx.stroke();

    // Net Posts
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(c.left - 18, netY - 10, 6, 14);
    ctx.fillRect(c.right + 12, netY - 10, 6, 14);
  }

  private renderShadows(ctx: CanvasRenderingContext2D): void {
    // Ball Shadow
    const shadowScale = Math.max(0.3, 1 - this.ball.z / 140);
    const shadowAlpha = Math.max(0.15, 0.6 - this.ball.z / 180);

    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(this.ball.x, this.ball.y, this.ball.radius * 1.4 * shadowScale, this.ball.radius * 0.7 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Player Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(this.player.x, this.player.y + 6, 22, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // AI Shadow
    ctx.beginPath();
    ctx.ellipse(this.ai.x, this.ai.y + 6, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderPaddle(ctx: CanvasRenderingContext2D, paddle: PlayerPaddle, role: 'player' | 'ai'): void {
    ctx.save();
    ctx.translate(paddle.x, paddle.y);

    // Player Athlete Character
    const isPlayer = role === 'player';
    const primaryColor = isPlayer ? '#06b6d4' : '#f43f5e';
    const accentColor = isPlayer ? '#38bdf8' : '#fb7185';

    // Body
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.roundRect(-14, -8, 28, 16, 6);
    ctx.fill();

    // Head with sports headband
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(0, isPlayer ? -14 : 14, 7, 0, Math.PI * 2);
    ctx.fill();

    // Headband
    ctx.fillStyle = accentColor;
    ctx.fillRect(-6, isPlayer ? -16 : 12, 12, 3);

    // Cyber Racket in hand with swinging animation
    ctx.save();
    const racketOffsetX = 18;
    const racketOffsetY = isPlayer ? -8 : 8;
    ctx.translate(racketOffsetX, racketOffsetY);
    ctx.rotate(paddle.racketAngle);

    // Racket Handle & Shaft
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, isPlayer ? -16 : 16);
    ctx.stroke();

    // Racket Head Ring
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, isPlayer ? -26 : 26, 9, 13, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Neon Strings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, isPlayer ? -26 : 26);
    ctx.lineTo(5, isPlayer ? -26 : 26);
    ctx.moveTo(0, isPlayer ? -34 : 18);
    ctx.lineTo(0, isPlayer ? -18 : 34);
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  }

  private renderBall(ctx: CanvasRenderingContext2D): void {
    const b = this.ball;

    // Render Trail
    for (const t of b.trail) {
      ctx.fillStyle = `rgba(204, 255, 0, ${t.alpha * 0.35})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y - t.z, b.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ball elevated position: (x, y - z)
    const drawY = b.y - b.z;
    const drawRadius = b.radius * (1 + b.z / 90);

    // Glowing Neon Tennis Ball (Optic Yellow / Neon Lime)
    const ballGrad = ctx.createRadialGradient(b.x - 2, drawY - 2, 1, b.x, drawY, drawRadius);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.3, '#d9f99d');
    ballGrad.addColorStop(0.8, '#a3e635');
    ballGrad.addColorStop(1, '#65a30d');

    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(b.x, drawY, drawRadius, 0, Math.PI * 2);
    ctx.fill();

    // Tennis Ball Seam Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(b.x - 2, drawY, drawRadius * 0.75, -Math.PI / 3, Math.PI / 3);
    ctx.stroke();
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    for (const t of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = t.alpha;
      ctx.font = '900 18px Inter, sans-serif';
      ctx.textAlign = 'center';

      // Drop shadow for text
      ctx.fillStyle = '#000000';
      ctx.fillText(t.text, t.x + 1, t.y + 1);

      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }
}
