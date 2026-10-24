import { describe, expect, it } from 'vitest';
import {
  computeCalibration,
  extractPoseSummary,
  LANDMARK_INDEX,
} from '../src/controller/gestures/calibration.js';
import type { NormalizedLandmark, PoseSummary } from '../src/controller/gestures/types.js';

describe('Calibration System', () => {
  function makeMockLandmarks(options: {
    hipY?: number;
    hipX?: number;
    visibility?: number;
  } = {}): NormalizedLandmark[] {
    const hipY = options.hipY ?? 0.6;
    const hipX = options.hipX ?? 0.5;
    const vis = options.visibility ?? 0.95;

    const list: NormalizedLandmark[] = new Array(33).fill(null).map(() => ({
      x: 0.5,
      y: 0.5,
      visibility: vis,
    }));

    // Shoulders
    list[LANDMARK_INDEX.LEFT_SHOULDER] = { x: hipX - 0.1, y: hipY - 0.25, visibility: vis };
    list[LANDMARK_INDEX.RIGHT_SHOULDER] = { x: hipX + 0.1, y: hipY - 0.25, visibility: vis };

    // Hips
    list[LANDMARK_INDEX.LEFT_HIP] = { x: hipX - 0.08, y: hipY, visibility: vis };
    list[LANDMARK_INDEX.RIGHT_HIP] = { x: hipX + 0.08, y: hipY, visibility: vis };

    // Knees
    list[LANDMARK_INDEX.LEFT_KNEE] = { x: hipX - 0.08, y: hipY + 0.2, visibility: vis };
    list[LANDMARK_INDEX.RIGHT_KNEE] = { x: hipX + 0.08, y: hipY + 0.2, visibility: vis };

    return list;
  }

  it('extracts pose summary with valid confidence', () => {
    const landmarks = makeMockLandmarks({ hipY: 0.62, hipX: 0.5 });
    const summary = extractPoseSummary(landmarks, 1000, 0.5);

    expect(summary.isValid).toBe(true);
    expect(summary.hipY).toBeCloseTo(0.62);
    expect(summary.torsoCenterX).toBeCloseTo(0.5);
    expect(summary.torsoHeight).toBeCloseTo(0.25);
  });

  it('rejects frames with low confidence', () => {
    const landmarks = makeMockLandmarks({ visibility: 0.3 });
    const summary = extractPoseSummary(landmarks, 1000, 0.5);

    expect(summary.isValid).toBe(false);
    expect(summary.minConfidence).toBeLessThan(0.5);
  });

  it('rejects calibration when insufficient samples are collected', () => {
    const samples: PoseSummary[] = [];
    for (let i = 0; i < 5; i++) {
      samples.push(extractPoseSummary(makeMockLandmarks(), 1000 + i * 50));
    }

    const result = computeCalibration(samples, 15);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toContain('Insufficient valid samples');
    }
  });

  it('rejects calibration when movement variance is too high (standing unstable)', () => {
    const samples: PoseSummary[] = [];
    for (let i = 0; i < 20; i++) {
      // Wildly fluctuating hip height
      const fluctuatingY = 0.4 + (i % 2 === 0 ? 0.3 : -0.2);
      samples.push(extractPoseSummary(makeMockLandmarks({ hipY: fluctuatingY }), 1000 + i * 50));
    }

    const result = computeCalibration(samples, 15, 0.08);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toContain('Too much movement detected');
    }
  });

  it('computes accurate baseline calibration on stable neutral samples', () => {
    const samples: PoseSummary[] = [];
    for (let i = 0; i < 20; i++) {
      // Slight tiny natural sway of 0.002
      const sway = (Math.sin(i) * 0.002);
      samples.push(extractPoseSummary(makeMockLandmarks({ hipY: 0.60 + sway, hipX: 0.50 + sway }), 1000 + i * 50));
    }

    const result = computeCalibration(samples, 15);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.calibration.isCalibrated).toBe(true);
      expect(result.calibration.baselineHipY).toBeCloseTo(0.60, 2);
      expect(result.calibration.baselineCenterX).toBeCloseTo(0.50, 2);
      expect(result.calibration.sampleCount).toBe(20);
    }
  });
});
