import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_GESTURE_CONFIG, type GestureConfig } from '../src/controller/gestures/config.js';
import { detectGestures, resetGestureState } from '../src/controller/gestures/detector.js';
import type {
  CalibrationData,
  GestureDetectorState,
  PoseSummary,
} from '../src/controller/gestures/types.js';

describe('GestureDetector Unit Tests', () => {
  let calibration: CalibrationData;
  let state: GestureDetectorState;
  let config: GestureConfig;

  beforeEach(() => {
    state = resetGestureState();
    config = { ...DEFAULT_GESTURE_CONFIG };
    calibration = {
      isCalibrated: true,
      baselineHipY: 0.60,
      baselineTorsoCenterY: 0.47,
      baselineCenterX: 0.50,
      baselineTorsoHeight: 0.25,
      baselineKneeY: 0.80,
      sampleCount: 20,
      calibratedAt: 1000,
    };
  });

  function makePose(options: {
    hipY?: number;
    hipX?: number;
    torsoCenterX?: number;
    kneeY?: number;
    confidence?: number;
    isValid?: boolean;
    timestamp?: number;
  }): PoseSummary {
    const hipY = options.hipY ?? 0.60;
    const hipX = options.hipX ?? 0.50;
    const kneeY = options.kneeY ?? 0.80;
    return {
      timestamp: options.timestamp ?? 1000,
      isValid: options.isValid ?? true,
      minConfidence: options.confidence ?? 0.9,
      hipY,
      hipX,
      shoulderY: hipY - 0.25,
      shoulderX: hipX,
      kneeY,
      torsoCenterY: hipY - 0.125,
      torsoCenterX: options.torsoCenterX ?? hipX,
      torsoHeight: 0.25,
    };
  }

  it('does not trigger gestures when standing neutral', () => {
    const pose = makePose({ hipY: 0.60, torsoCenterX: 0.50 });
    const res = detectGestures(pose, calibration, state, config, 1000);
    expect(res.gesture).toBeNull();
    expect(state.jumpState).toBe('GROUNDED');
  });

  it('triggers jump on rapid upward hip displacement', () => {
    // In screen coords, Y=0 is top. Baseline is 0.60.
    // Upward jump moves hip to 0.52 (deltaY = -0.08, exceeding threshold 0.042)
    const jumpPose = makePose({ hipY: 0.52 });
    const res = detectGestures(jumpPose, calibration, state, config, 1000);

    expect(res.gesture).toBe('jump');
    expect(state.jumpState).toBe('AIRBORNE');
  });

  it('does NOT repeatedly trigger jump while airborne in subsequent frames', () => {
    const jumpPose = makePose({ hipY: 0.52 });
    // First frame: triggers jump
    const res1 = detectGestures(jumpPose, calibration, state, config, 1000);
    expect(res1.gesture).toBe('jump');
    expect(state.jumpState).toBe('AIRBORNE');

    // Second frame: still in the air (hipY = 0.51)
    const res2 = detectGestures(makePose({ hipY: 0.51 }), calibration, state, config, 1050);
    expect(res2.gesture).toBeNull(); // Must not fire!
    expect(state.jumpState).toBe('AIRBORNE');

    // Third frame: still in the air (hipY = 0.53)
    const res3 = detectGestures(makePose({ hipY: 0.53 }), calibration, state, config, 1100);
    expect(res3.gesture).toBeNull(); // Must not fire!
    expect(state.jumpState).toBe('AIRBORNE');
  });

  it('re-arms jump after landing back at baseline and waiting cooldown', () => {
    // Jump
    detectGestures(makePose({ hipY: 0.52 }), calibration, state, config, 1000);
    expect(state.jumpState).toBe('AIRBORNE');

    // Landing frame (hipY returns to 0.59)
    detectGestures(makePose({ hipY: 0.59 }), calibration, state, config, 1200);
    expect(state.jumpState).toBe('COOLDOWN');

    // Cooldown elapsed at 1000 + 450 = 1450ms
    detectGestures(makePose({ hipY: 0.60 }), calibration, state, config, 1500);
    expect(state.jumpState).toBe('GROUNDED');

    // Next jump can now fire!
    const resNext = detectGestures(makePose({ hipY: 0.52 }), calibration, state, config, 1550);
    expect(resNext.gesture).toBe('jump');
  });

  it('ignores frames when confidence is too low or person is out of frame', () => {
    const lowConfPose = makePose({ hipY: 0.50, confidence: 0.2 });
    const res = detectGestures(lowConfPose, calibration, state, config, 1000);
    expect(res.gesture).toBeNull();
    expect(state.jumpState).toBe('GROUNDED');

    const invalidPose = makePose({ hipY: 0.50, isValid: false });
    const resInv = detectGestures(invalidPose, calibration, state, config, 1050);
    expect(resInv.gesture).toBeNull();
  });

  it('triggers squat when held for configured duration and does not repeat while holding', () => {
    // Squatting moves hip down: baseline 0.60 -> 0.67 (deltaY = +0.07, threshold is 0.045)
    const squatPose = makePose({ hipY: 0.67, kneeY: 0.73 });

    // Frame 1: entered squat position (PRE_SQUAT)
    const res1 = detectGestures(squatPose, calibration, state, config, 1000);
    expect(res1.gesture).toBeNull();
    expect(state.squatState).toBe('PRE_SQUAT');

    // Frame 2: before hold duration (50ms < minHoldMs 120ms)
    const res2 = detectGestures(squatPose, calibration, state, config, 1050);
    expect(res2.gesture).toBeNull();

    // Frame 3: held long enough (150ms > 120ms) -> triggers squat!
    const res3 = detectGestures(squatPose, calibration, state, config, 1150);
    expect(res3.gesture).toBe('squat');
    expect(state.squatState).toBe('SQUATTING');

    // Frame 4: still holding squat -> must NOT fire again!
    const res4 = detectGestures(squatPose, calibration, state, config, 1250);
    expect(res4.gesture).toBeNull();
    expect(state.squatState).toBe('SQUATTING');

    // Frame 5: stand back up (hipY = 0.60) -> re-arms
    detectGestures(makePose({ hipY: 0.60 }), calibration, state, config, 1400);
    expect(state.squatState).toBe('STANDING');
  });

  it('detects left and right movement with hysteresis band', () => {
    // Baseline center X is 0.50.
    // Move Left: torsoCenterX = 0.42 (deltaX = -0.08, threshold is 0.055)
    const leftPose = makePose({ torsoCenterX: 0.42, hipX: 0.42 });
    const resLeft = detectGestures(leftPose, calibration, state, config, 1000);
    expect(resLeft.gesture).toBe('left');
    expect(state.lateralState).toBe('LEFT');

    // Still on left: does not re-trigger repeatedly
    const resLeftAgain = detectGestures(leftPose, calibration, state, config, 1050);
    expect(resLeftAgain.gesture).toBeNull();

    // Return to hysteresis deadband (center = 0.49, within 0.028 of 0.50)
    detectGestures(makePose({ torsoCenterX: 0.49, hipX: 0.49 }), calibration, state, config, 1400);
    expect(state.lateralState).toBe('NEUTRAL');

    // Move Right: torsoCenterX = 0.58 (deltaX = +0.08)
    const rightPose = makePose({ torsoCenterX: 0.58, hipX: 0.58 });
    const resRight = detectGestures(rightPose, calibration, state, config, 1500);
    expect(resRight.gesture).toBe('right');
    expect(state.lateralState).toBe('RIGHT');
  });
});
