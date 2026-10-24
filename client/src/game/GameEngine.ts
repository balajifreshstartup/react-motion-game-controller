import type { GestureType } from '@motion-game/protocol';
import type { GameState, GameStats, Lane, Obstacle, Particle, PlayerPosture } from './types.js';

export interface GameEngineCallbacks {
  onStatsUpdate: (stats: GameStats) => void;
  onStateChange: (state: GameState) => void;
  onGestureFeedback: (gesture: string) => void;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: GameEngineCallbacks;

  private state: GameState = 'START';
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;

  // Player properties
  private player = {
    x: 140,
    y: 0,
    vy: 0,
    groundY: 0,
    width: 38,
    height: 64,
    posture: 'RUNNING' as PlayerPosture,
    slideTimer: 0,
    maxSlideDuration: 650, // ms
    invulnerableTimer: 0,
    currentLane: 1 as Lane, // 0: Left, 1: Center, 2: Right
    targetLaneX: 140,
    laneOffset: 0,
    runAnimTime: 0,
  };

  // Game physics & mechanics (tuned for accessible motion gameplay)
  private gravity = 0.56;
  private jumpForce = -12.4;
  private baseSpeed = 220; // px/sec (relaxed and accessible pace)
  private currentSpeed = 220;
  private speedMultiplier = 1.0;
  private distanceTraveled = 0;
  private score = 0;
  private highScore = 0;
  private coins = 0;
  private lives = 3;

  // Obstacles & particles
  private obstacles: Obstacle[] = [];
  private nextObstacleDist = 400;
  private nextObstacleId = 1;
  private particles: Particle[] = [];
  private screenShake = 0;

  // Throttled stats dispatch
  private lastStatsDispatchTime = 0;

  // Input states
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private isDestroyed = false;

  constructor(canvas: HTMLCanvasElement, callbacks: GameEngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to acquire 2D canvas context');
    }
    this.ctx = context;
    this.callbacks = callbacks;

    // Load high score
    try {
      const saved = localStorage.getItem('motion_game_high_score');
      if (saved) this.highScore = parseInt(saved, 10) || 0;
    } catch {
      // LocalStorage unavailable
    }

    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);

    this.resizeCanvas();
    this.initPlayer();
  }

  public resizeCanvas(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect() || { width: 800, height: 480 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);

    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);

    this.player.groundY = rect.height - 90;
    if (this.player.posture === 'RUNNING') {
      this.player.y = this.player.groundY;
    }
  }

  private initPlayer(): void {
    const height = parseFloat(this.canvas.style.height) || 480;
    this.player.groundY = height - 90;
    this.player.y = this.player.groundY;
    this.player.vy = 0;
    this.player.posture = 'RUNNING';
    this.player.currentLane = 1;
    this.player.x = 140;
    this.player.targetLaneX = 140;
  }

  public start(): void {
    if (this.state === 'PLAYING') return;

    this.state = 'PLAYING';
    this.score = 0;
    this.distanceTraveled = 0;
    this.coins = 0;
    this.lives = 3;
    this.currentSpeed = this.baseSpeed;
    this.speedMultiplier = 1.0;
    this.obstacles = [];
    this.particles = [];
    this.nextObstacleDist = 350;
    this.initPlayer();

    this.callbacks.onStateChange('PLAYING');
    this.dispatchStats(true);

    this.lastFrameTime = performance.now();
    if (!this.animationFrameId) {
      this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
    }
  }

  public pause(): void {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.callbacks.onStateChange('PAUSED');
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.lastFrameTime = performance.now();
      this.callbacks.onStateChange('PLAYING');
    }
  }

  public restart(): void {
    this.start();
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
  }

  // --- External Input Handlers (from Gestures / Sensors / Keyboard) ---

  public handleGesture(gesture: GestureType): void {
    if (this.state !== 'PLAYING') {
      if (gesture === 'jump' && (this.state === 'START' || this.state === 'GAMEOVER')) {
        this.restart();
      }
      return;
    }

    this.callbacks.onGestureFeedback(gesture.toUpperCase());

    switch (gesture) {
      case 'jump':
        this.triggerJump();
        break;
      case 'squat':
        this.triggerSquat();
        break;
      case 'left':
        this.shiftLane(-1);
        break;
      case 'right':
        this.shiftLane(1);
        break;
      case 'neutral':
        // Reset tilt / center
        break;
    }
  }

  public handleTilt(tiltX: number, _tiltY: number): void {
    if (this.state !== 'PLAYING') return;

    // Smooth continuous steering offset (-35px to +35px)
    this.player.laneOffset = tiltX * 45;
  }

  private triggerJump(): void {
    // Only jump if on ground or sliding
    if (this.player.y >= this.player.groundY - 2) {
      this.player.vy = this.jumpForce;
      this.player.posture = 'JUMPING';
      this.player.slideTimer = 0;
      this.createJumpParticles(this.player.x, this.player.y + this.player.height);
    }
  }

  private triggerSquat(): void {
    // Cannot slide if already airborne
    if (this.player.y >= this.player.groundY - 2) {
      this.player.posture = 'SLIDING';
      this.player.slideTimer = this.player.maxSlideDuration;
      this.createSlideParticles(this.player.x, this.player.y + this.player.height);
    }
  }

  private shiftLane(direction: -1 | 1): void {
    const newLane = (this.player.currentLane + direction) as Lane;
    if (newLane >= 0 && newLane <= 2) {
      this.player.currentLane = newLane;
      // Lane positions: Lane 0 = 90, Lane 1 = 140, Lane 2 = 190
      const laneOffsets = [90, 140, 190];
      this.player.targetLaneX = laneOffsets[newLane];
      this.createLaneShiftParticles(this.player.x, this.player.y + 20);
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }

    if (e.code === 'KeyP') {
      this.pause();
      return;
    }

    if (this.state === 'START' || this.state === 'GAMEOVER') {
      if (e.code === 'Space' || e.code === 'Enter') {
        this.start();
        return;
      }
    }

    if (this.state !== 'PLAYING') return;

    if (e.code === 'Space' || e.code === 'ArrowUp') {
      this.triggerJump();
    } else if (e.code === 'ArrowDown') {
      this.triggerSquat();
    } else if (e.code === 'ArrowLeft') {
      this.shiftLane(-1);
    } else if (e.code === 'ArrowRight') {
      this.shiftLane(1);
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    // If user releases ArrowDown, cancel slide early
    if (e.code === 'ArrowDown' && this.player.posture === 'SLIDING') {
      this.player.slideTimer = Math.min(this.player.slideTimer, 80);
    }
  }

  // --- Main Simulation Loop ---

  private gameLoop(timestamp: number): void {
    if (this.isDestroyed) return;

    const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.05); // cap delta time to 50ms
    this.lastFrameTime = timestamp;

    if (this.state === 'PLAYING') {
      this.update(dt);
    }

    this.render();

    this.animationFrameId = requestAnimationFrame(this.gameLoop.bind(this));
  }

  private update(dt: number): void {
    // Increase distance and speed
    const frameDistance = this.currentSpeed * dt;
    this.distanceTraveled += frameDistance;
    this.score = Math.floor(this.distanceTraveled / 10) + this.coins * 100;

    // Very gradual difficulty increase capped for comfortable play
    this.speedMultiplier = 1.0 + Math.min(0.35, this.distanceTraveled / 16000);
    this.currentSpeed = this.baseSpeed * this.speedMultiplier;

    // Smooth horizontal lane interpolation
    this.player.x += (this.player.targetLaneX + this.player.laneOffset - this.player.x) * 12 * dt;

    // Vertical physics
    if (this.player.posture === 'JUMPING') {
      this.player.y += this.player.vy;
      this.player.vy += this.gravity;

      // Landing check
      if (this.player.y >= this.player.groundY) {
        this.player.y = this.player.groundY;
        this.player.vy = 0;
        this.player.posture = 'RUNNING';
        this.createLandingParticles(this.player.x, this.player.y + this.player.height);
      }
    } else if (this.player.posture === 'SLIDING') {
      this.player.slideTimer -= dt * 1000;
      if (this.player.slideTimer <= 0) {
        this.player.posture = 'RUNNING';
      }
    } else {
      this.player.runAnimTime += dt * 14 * this.speedMultiplier;
    }

    // Invulnerability timer
    if (this.player.invulnerableTimer > 0) {
      this.player.invulnerableTimer -= dt;
    }

    // Screen shake decay
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    // Update obstacles
    this.updateObstacles(dt, frameDistance);

    // Update particles
    this.updateParticles(dt);

    // Dispatch stats throttled to ~5 times per second
    const now = performance.now();
    if (now - this.lastStatsDispatchTime > 200) {
      this.dispatchStats();
      this.lastStatsDispatchTime = now;
    }
  }

  private updateObstacles(dt: number, frameDistance: number): void {
    const screenWidth = parseFloat(this.canvas.style.width) || 800;

    // Spawn new obstacles
    this.nextObstacleDist -= frameDistance;
    if (this.nextObstacleDist <= 0) {
      this.spawnObstacle(screenWidth);
      // Spawn distance between 580 and 840 px (ample reaction time for motions)
      this.nextObstacleDist = 580 + Math.random() * 260;
    }

    // Move existing obstacles leftwards
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= frameDistance;

      // Check collision
      if (!obs.passed && !obs.collected && this.checkCollision(obs)) {
        if (obs.type === 'ENERGY_ORB') {
          obs.collected = true;
          this.coins++;
          this.score += 100;
          this.createCoinParticles(obs.x + obs.width / 2, obs.y + obs.height / 2);
          this.callbacks.onGestureFeedback('+100 ENERGY!');
        } else {
          // Obstacle hit!
          obs.passed = true;
          this.handleHit();
        }
      }

      // Mark passed
      if (!obs.passed && obs.x + obs.width < this.player.x) {
        obs.passed = true;
      }

      // Remove off-screen obstacles
      if (obs.x + obs.width < -100) {
        this.obstacles.splice(i, 1);
      }
    }
  }

  private spawnObstacle(spawnX: number): void {
    const types: ('HURDLE' | 'OVERHEAD_LASER' | 'ENERGY_ORB')[] = [
      'HURDLE',
      'HURDLE',
      'OVERHEAD_LASER',
      'OVERHEAD_LASER',
      'ENERGY_ORB',
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    const lane = Math.floor(Math.random() * 3) as Lane;

    let y = 0;
    let width = 34;
    let height = 38;

    if (type === 'HURDLE') {
      // Ground barrier - requires JUMP
      y = this.player.groundY + this.player.height - 38;
      width = 44;
      height = 38;
    } else if (type === 'OVERHEAD_LASER') {
      // Overhead laser beam - requires SQUAT / SLIDE
      y = this.player.groundY - 14;
      width = 56;
      height = 36;
    } else if (type === 'ENERGY_ORB') {
      // Floating bonus orb
      y = this.player.groundY + (Math.random() > 0.5 ? -10 : 25);
      width = 24;
      height = 24;
    }

    this.obstacles.push({
      id: this.nextObstacleId++,
      type,
      x: spawnX + 40,
      y,
      width,
      height,
      lane,
      passed: false,
    });
  }

  private checkCollision(obs: Obstacle): boolean {
    if (this.player.invulnerableTimer > 0) return false;

    // Compute player hitbox based on posture
    let playerHitboxX = this.player.x - 14;
    let playerHitboxY = this.player.y;
    let playerHitboxW = 28;
    let playerHitboxH = this.player.height;

    if (this.player.posture === 'SLIDING') {
      // Sliding lowers height significantly!
      playerHitboxY = this.player.groundY + 34;
      playerHitboxH = 30;
      playerHitboxW = 40;
    }

    // AABB Collision
    return (
      playerHitboxX < obs.x + obs.width &&
      playerHitboxX + playerHitboxW > obs.x &&
      playerHitboxY < obs.y + obs.height &&
      playerHitboxY + playerHitboxH > obs.y
    );
  }

  private handleHit(): void {
    this.screenShake = 12;
    this.createExplosionParticles(this.player.x, this.player.y + 30);
    this.player.invulnerableTimer = 1.4; // 1.4 seconds invulnerability flashing
    this.lives--;

    this.callbacks.onGestureFeedback('STUMBLE!');
    this.dispatchStats();

    if (this.lives <= 0) {
      this.triggerGameOver();
    }
  }

  private triggerGameOver(): void {
    this.state = 'GAMEOVER';
    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        localStorage.setItem('motion_game_high_score', this.highScore.toString());
      } catch {
        // ignore
      }
    }
    this.callbacks.onStateChange('GAMEOVER');
    this.dispatchStats(true);
  }

  private dispatchStats(force = false): void {
    this.callbacks.onStatsUpdate({
      score: this.score,
      highScore: this.highScore,
      distance: Math.floor(this.distanceTraveled),
      coins: this.coins,
      multiplier: Number(this.speedMultiplier.toFixed(2)),
      lives: this.lives,
      speed: Math.floor(this.currentSpeed),
    });
  }

  // --- Rendering Functions ---

  private render(): void {
    const width = parseFloat(this.canvas.style.width) || 800;
    const height = parseFloat(this.canvas.style.height) || 480;
    const ctx = this.ctx;

    ctx.save();

    // Screen Shake effect
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // Background Cyberpunk Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#030712'); // slate-950
    bgGrad.addColorStop(0.65, '#0f172a'); // slate-900
    bgGrad.addColorStop(1, '#1e1b4b'); // indigo-950
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Parallax Skyline
    this.renderSkyline(width, height);

    // Neon Floor Grid
    this.renderNeonGrid(width, height);

    // Obstacles
    this.renderObstacles();

    // Particles
    this.renderParticles();

    // Player
    this.renderPlayer();

    // Overlay Screens (Start / Paused / GameOver)
    if (this.state === 'START') {
      this.renderStartOverlay(width, height);
    } else if (this.state === 'PAUSED') {
      this.renderPausedOverlay(width, height);
    } else if (this.state === 'GAMEOVER') {
      this.renderGameOverOverlay(width, height);
    }

    ctx.restore();
  }

  private renderSkyline(width: number, height: number): void {
    const ctx = this.ctx;
    const horizon = this.player.groundY;
    const scrollOffset = (this.distanceTraveled * 0.15) % width;

    // Distant cyber towers
    ctx.fillStyle = '#090d16';
    for (let x = -scrollOffset; x < width + 100; x += 60) {
      const bHeight = 80 + Math.abs(Math.sin(x * 12.3)) * 90;
      ctx.fillRect(x, horizon - bHeight, 45, bHeight);

      // Glowing windows
      ctx.fillStyle = '#06b6d422';
      for (let wy = horizon - bHeight + 10; wy < horizon - 10; wy += 15) {
        if ((x + wy) % 3 === 0) {
          ctx.fillRect(x + 10, wy, 8, 8);
        }
      }
      ctx.fillStyle = '#090d16';
    }
  }

  private renderNeonGrid(width: number, height: number): void {
    const ctx = this.ctx;
    const groundY = this.player.groundY + this.player.height;

    // Ground platform top glow line
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Moving horizontal grid lines
    ctx.strokeStyle = '#0891b233';
    ctx.lineWidth = 1;
    const gridOffset = (this.distanceTraveled * 1.0) % 40;
    for (let y = groundY; y < height; y += 14) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Perspective vertical grid stripes
    for (let x = -gridOffset; x < width + 40; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x - 30, height);
      ctx.stroke();
    }
  }

  private renderObstacles(): void {
    const ctx = this.ctx;

    for (const obs of this.obstacles) {
      if (obs.collected) continue;

      if (obs.type === 'HURDLE') {
        // Neon Spike Barrier (Jump over)
        ctx.fillStyle = '#f43f5e';
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.height);
        ctx.lineTo(obs.x + obs.width / 2, obs.y);
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
        ctx.closePath();
        ctx.fill();

        // Inner glowing core
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(obs.x + 8, obs.y + obs.height);
        ctx.lineTo(obs.x + obs.width / 2, obs.y + 12);
        ctx.lineTo(obs.x + obs.width - 8, obs.y + obs.height);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
      } else if (obs.type === 'OVERHEAD_LASER') {
        // High Laser Beam (Squat/Slide under)
        ctx.fillStyle = '#a855f7';
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 14;

        // Emitter posts
        ctx.fillRect(obs.x, obs.y, 8, obs.height);
        ctx.fillRect(obs.x + obs.width - 8, obs.y, 8, obs.height);

        // Pulsing laser beam
        const beamPulse = Math.sin(performance.now() * 0.01) * 3;
        ctx.fillStyle = '#e879f9';
        ctx.fillRect(obs.x + 8, obs.y + 10 - beamPulse / 2, obs.width - 16, 12 + beamPulse);

        // Core white hot line
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(obs.x + 8, obs.y + 14, obs.width - 16, 4);

        ctx.shadowBlur = 0;
      } else if (obs.type === 'ENERGY_ORB') {
        // Golden Collectible Orb
        const pulse = Math.sin(performance.now() * 0.008) * 4;
        const centerX = obs.x + obs.width / 2;
        const centerY = obs.y + obs.height / 2;

        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 16;

        ctx.beginPath();
        ctx.arc(centerX, centerY, 10 + pulse / 2, 0, Math.PI * 2);
        ctx.fill();

        // Inner bright gleam
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(centerX - 3, centerY - 3, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
      }
    }
  }

  private renderPlayer(): void {
    const ctx = this.ctx;
    const p = this.player;

    // Flashing invulnerability
    if (p.invulnerableTimer > 0 && Math.floor(p.invulnerableTimer * 10) % 2 === 0) {
      return;
    }

    ctx.save();
    ctx.translate(p.x, p.y);

    // Player Shadow on ground
    const shadowY = p.groundY + p.height - p.y;
    const shadowScale = Math.max(0.4, 1 - (p.groundY - p.y) / 180);
    ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, shadowY, 20 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (p.posture === 'SLIDING') {
      // Sliding low runner posture
      ctx.fillStyle = '#06b6d4';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 14;

      // Lower body rectangle sliding along floor
      ctx.fillRect(-22, p.height - 24, 44, 22);

      // Glowing cyan visor
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(6, p.height - 20, 10, 6);

      // Sliding friction sparks
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-24, p.height - 4, 6, 4);
    } else {
      // Upright Runner
      const legPhase = Math.sin(p.runAnimTime);
      const armPhase = Math.cos(p.runAnimTime);

      ctx.fillStyle = '#06b6d4';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 12;

      // Torso
      ctx.fillRect(-12, 16, 24, 30);

      // Head & Helmet
      ctx.fillRect(-10, 0, 20, 16);

      // Glowing Neon Visor
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 4, 10, 5);

      // Limbs
      ctx.fillStyle = '#0891b2';
      if (p.posture === 'JUMPING') {
        // Tucked jump legs
        ctx.fillRect(-10, 46, 8, 12);
        ctx.fillRect(2, 44, 8, 14);
      } else {
        // Running leg cycle
        ctx.fillRect(-10, 46, 8, 18 + legPhase * 8);
        ctx.fillRect(2, 46, 8, 18 - legPhase * 8);
      }

      // Back jetpack / booster
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(-16, 20, 4, 14);
      if (p.posture === 'JUMPING') {
        // Booster flame
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-17, 34, 6, 8 + Math.random() * 6);
      }
    }

    ctx.restore();
  }

  private renderParticles(): void {
    const ctx = this.ctx;
    for (const pt of this.particles) {
      const alpha = pt.life / pt.maxLife;
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 6;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private createJumpParticles(x: number, y: number): void {
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y - 4,
        vx: (Math.random() - 0.5) * 80 - 40,
        vy: Math.random() * 40 + 10,
        life: 0.35,
        maxLife: 0.35,
        color: '#06b6d4',
        size: Math.random() * 4 + 2,
      });
    }
  }

  private createSlideParticles(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: x - 20,
        y: y - 2,
        vx: -Math.random() * 120 - 40,
        vy: -Math.random() * 40,
        life: 0.25,
        maxLife: 0.25,
        color: '#f59e0b',
        size: Math.random() * 3 + 1,
      });
    }
  }

  private createLaneShiftParticles(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60,
        life: 0.3,
        maxLife: 0.3,
        color: '#a855f7',
        size: 3,
      });
    }
  }

  private createLandingParticles(x: number, y: number): void {
    for (let i = 0; i < 12; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 160,
        vy: -Math.random() * 50,
        life: 0.4,
        maxLife: 0.4,
        color: '#22d3ee',
        size: 3,
      });
    }
  }

  private createCoinParticles(x: number, y: number): void {
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16;
      const speed = Math.random() * 100 + 40;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5,
        maxLife: 0.5,
        color: '#fbbf24',
        size: 4,
      });
    }
  }

  private createExplosionParticles(x: number, y: number): void {
    for (let i = 0; i < 24; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 260,
        vy: (Math.random() - 0.5) * 260,
        life: 0.6,
        maxLife: 0.6,
        color: '#f43f5e',
        size: Math.random() * 5 + 2,
      });
    }
  }

  private renderStartOverlay(width: number, height: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(3, 7, 18, 0.75)';
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 36px Outfit, sans-serif';
    ctx.fillText('CYBER MOTION DASH', width / 2, height / 2 - 40);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px Outfit, sans-serif';
    ctx.fillText('Control with your body gestures or keyboard', width / 2, height / 2);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.fillText('Press SPACE or JUMP on phone to start', width / 2, height / 2 + 50);
  }

  private renderPausedOverlay(width: number, height: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(3, 7, 18, 0.65)';
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 32px Outfit, sans-serif';
    ctx.fillText('GAME PAUSED', width / 2, height / 2);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px Outfit, sans-serif';
    ctx.fillText('Press P or click Pause button to resume', width / 2, height / 2 + 40);
  }

  private renderGameOverOverlay(width: number, height: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(3, 7, 18, 0.85)';
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 36px Outfit, sans-serif';
    ctx.fillText('GAME OVER', width / 2, height / 2 - 50);

    ctx.fillStyle = '#ffffff';
    ctx.font = '22px Outfit, sans-serif';
    ctx.fillText(`Final Score: ${this.score}`, width / 2, height / 2 - 10);

    ctx.fillStyle = '#f59e0b';
    ctx.font = '18px Outfit, sans-serif';
    ctx.fillText(`Best Score: ${this.highScore}`, width / 2, height / 2 + 25);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.fillText('Press SPACE, ENTER or JUMP on phone to restart', width / 2, height / 2 + 75);
  }
}
