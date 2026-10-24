import { describe, expect, it, vi } from 'vitest';
import { TennisEngine } from '../src/game/tennis/TennisEngine.js';

// Mock canvas & 2D context
function createMockCanvas(): HTMLCanvasElement {
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    resetTransform: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    strokeRect: vi.fn(),
    fillRect: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
  };

  const canvas = {
    getContext: vi.fn(() => context),
    parentElement: {
      getBoundingClientRect: () => ({ width: 800, height: 600 }),
    },
    style: { width: '800px', height: '600px' },
    width: 800,
    height: 600,
  } as unknown as HTMLCanvasElement;

  return canvas;
}

describe('2D Tennis Engine & Motion Controls', () => {
  it('initializes in SERVE_PLAYER state and configures court geometry', () => {
    const canvas = createMockCanvas();
    const onStatsUpdate = vi.fn();
    const onStateChange = vi.fn();
    const onFeedback = vi.fn();

    const engine = new TennisEngine(canvas, {
      onStatsUpdate,
      onStateChange,
      onFeedback,
    });

    expect(engine).toBeDefined();
    expect(onStateChange).toHaveBeenCalledWith('SERVE_PLAYER');
    expect(onStatsUpdate).toHaveBeenCalled();

    engine.destroy();
  });

  it('maps phone tiltX to baseline position within court boundaries', () => {
    const canvas = createMockCanvas();
    const engine = new TennisEngine(canvas, {
      onStatsUpdate: vi.fn(),
      onStateChange: vi.fn(),
      onFeedback: vi.fn(),
    });

    // Tilt completely left (-1)
    engine.handleTilt(-1, 0);
    const playerXLeft = (engine as unknown as { player: { targetX: number } }).player.targetX;

    // Tilt completely right (+1)
    engine.handleTilt(1, 0);
    const playerXRight = (engine as unknown as { player: { targetX: number } }).player.targetX;

    expect(playerXRight).toBeGreaterThan(playerXLeft);

    engine.destroy();
  });

  it('triggers serve or swing when gesture is received', () => {
    const canvas = createMockCanvas();
    const onStateChange = vi.fn();

    const engine = new TennisEngine(canvas, {
      onStatsUpdate: vi.fn(),
      onStateChange,
      onFeedback: vi.fn(),
    });

    // Serving from gesture
    engine.handleGesture('jump');
    const ballInPlay = (engine as unknown as { ball: { inPlay: boolean } }).ball.inPlay;
    expect(ballInPlay).toBe(true);

    engine.destroy();
  });

  it('correctly scores points and tracks rallies', () => {
    const canvas = createMockCanvas();
    let latestStats: unknown = null;

    const engine = new TennisEngine(canvas, {
      onStatsUpdate: (s) => {
        latestStats = s;
      },
      onStateChange: vi.fn(),
      onFeedback: vi.fn(),
    });

    // Simulate winning a point
    (engine as unknown as { awardPoint: (w: string, r: string) => void }).awardPoint('player', 'WINNER');

    expect(latestStats).toBeDefined();
    const scoreText = (latestStats as { scoreText: string }).scoreText;
    // 15 - LOVE
    expect(scoreText).toContain('15');

    engine.destroy();
  });
});
