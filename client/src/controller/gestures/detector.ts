import type { GestureType } from '@motion-game/protocol';
import type { GestureConfig } from './config.js';
import type {
  CalibrationData,
  GestureDetectionResult,
  GestureDetectorState,
  PoseSummary,
} from './types.js';

export function resetGestureState(): GestureDetectorState {
  return {
    jumpState: 'GROUNDED',
    lastJumpTime: 0,
    airborneFrames: 0,

    squatState: 'STANDING',
    squatStartTime: 0,
    lastSquatTriggerTime: 0,

    lateralState: 'NEUTRAL',
    lastLateralTime: 0,

    lastGestureTime: 0,
    lastDetectedGesture: null,
  };
}

/**
 * Pure function: Evaluates current pose summary against calibration baselines
 * and advances state machines for Jump, Squat, and Left/Right movement.
 */
export function detectGestures(
  summary: PoseSummary,
  calibration: CalibrationData,
  state: GestureDetectorState,
  config: GestureConfig,
  now: number = Date.now()
): GestureDetectionResult {
  const result: GestureDetectionResult = {
    gesture: null,
    confidence: summary.minConfidence,
    debug: {
      hipDisplacementY: 0,
      squatRatio: 0,
      lateralDisplacementX: 0,
      jumpState: state.jumpState,
      squatState: state.squatState,
      lateralState: state.lateralState,
    },
  };

  if (!calibration.isCalibrated) {
    result.reason = 'Not calibrated';
    return result;
  }

  if (!summary.isValid || summary.minConfidence < config.minLandmarkConfidence) {
    result.reason = 'Insufficient landmark confidence';
    return result;
  }

  // Delta calculations
  // In screen space: Y=0 is top, Y=1 is bottom.
  // Upward hip movement produces negative deltaHipY (e.g., -0.06).
  const deltaHipY = summary.hipY - calibration.baselineHipY;
  // Normalized to torso height for body-scale invariance
  const normalizedDeltaY = deltaHipY / Math.max(0.1, calibration.baselineTorsoHeight);

  // Lateral X displacement (negative is Left, positive is Right)
  const deltaCenterX = summary.torsoCenterX - calibration.baselineCenterX;
  const torsoLeanX = (summary.shoulderX - summary.hipX);
  const effectiveLateralX = deltaCenterX + (torsoLeanX * 0.4);

  // Hip-to-knee distance ratio compared to baseline
  const currentHipKneeDist = Math.max(0.01, summary.kneeY - summary.hipY);
  const baselineHipKneeDist = Math.max(0.01, calibration.baselineKneeY - calibration.baselineHipY);
  const squatRatio = currentHipKneeDist / baselineHipKneeDist;

  result.debug.hipDisplacementY = deltaHipY;
  result.debug.squatRatio = squatRatio;
  result.debug.lateralDisplacementX = effectiveLateralX;

  // --- 1. JUMP DETECTION ---
  // Rapid upward hip displacement crossing jumpThreshold
  const isUpwardDisplaced = deltaHipY < -config.jumpThreshold;
  const isNearBaseline = deltaHipY >= -config.jumpLandingThreshold;

  if (state.jumpState === 'GROUNDED') {
    if (isUpwardDisplaced && now - state.lastJumpTime >= config.jumpCooldownMs) {
      // Trigger Jump!
      state.jumpState = 'AIRBORNE';
      state.lastJumpTime = now;
      state.airborneFrames = 1;
      state.lastGestureTime = now;
      state.lastDetectedGesture = 'jump';

      result.gesture = 'jump';
      result.reason = 'Jump triggered on upward displacement';
      result.debug.jumpState = state.jumpState;
      return result;
    }
  } else if (state.jumpState === 'AIRBORNE') {
    state.airborneFrames++;
    // While still airborne, do NOT fire repeated jump events!
    if (isNearBaseline) {
      // User has landed back near neutral baseline
      state.jumpState = 'COOLDOWN';
    }
  } else if (state.jumpState === 'COOLDOWN') {
    if (now - state.lastJumpTime >= config.jumpCooldownMs && isNearBaseline) {
      // Fully landed and cooldown elapsed: re-arm
      state.jumpState = 'GROUNDED';
      state.airborneFrames = 0;
    }
  }

  // --- 2. SQUAT DETECTION ---
  // Downward hip displacement (deltaHipY > squatThreshold) or knee bend ratio < 0.80
  const isDownwardDisplaced = deltaHipY > config.squatThreshold || squatRatio < 0.78;
  const isSquatRecovered = deltaHipY <= config.squatResetThreshold && squatRatio >= 0.90;

  if (state.jumpState === 'GROUNDED') {
    if (state.squatState === 'STANDING') {
      if (isDownwardDisplaced) {
        state.squatState = 'PRE_SQUAT';
        state.squatStartTime = now;
      }
    } else if (state.squatState === 'PRE_SQUAT') {
      if (!isDownwardDisplaced) {
        state.squatState = 'STANDING';
      } else if (
        now - state.squatStartTime >= config.squatMinHoldMs &&
        now - state.lastSquatTriggerTime >= config.squatCooldownMs
      ) {
        // Trigger Squat!
        state.squatState = 'SQUATTING';
        state.lastSquatTriggerTime = now;
        state.lastGestureTime = now;
        state.lastDetectedGesture = 'squat';

        result.gesture = 'squat';
        result.reason = 'Squat triggered and held';
        result.debug.squatState = state.squatState;
        return result;
      }
    } else if (state.squatState === 'SQUATTING') {
      // User remains squatting; do not repeatedly fire
      if (isSquatRecovered) {
        state.squatState = 'STANDING';
      }
    }
  }

  // --- 3. LATERAL MOVEMENT (LEFT / RIGHT) ---
  // Torso center horizontal displacement with hysteresis to avoid jitter
  if (state.jumpState === 'GROUNDED') {
    if (effectiveLateralX < -config.lateralTriggerThreshold) {
      // Left direction
      if (
        state.lateralState !== 'LEFT' &&
        now - state.lastLateralTime >= config.lateralCooldownMs &&
        now - state.lastGestureTime >= config.globalRefractoryMs
      ) {
        state.lateralState = 'LEFT';
        state.lastLateralTime = now;
        state.lastGestureTime = now;
        state.lastDetectedGesture = 'left';

        result.gesture = 'left';
        result.reason = 'Shifted left';
        result.debug.lateralState = state.lateralState;
        return result;
      }
    } else if (effectiveLateralX > config.lateralTriggerThreshold) {
      // Right direction
      if (
        state.lateralState !== 'RIGHT' &&
        now - state.lastLateralTime >= config.lateralCooldownMs &&
        now - state.lastGestureTime >= config.globalRefractoryMs
      ) {
        state.lateralState = 'RIGHT';
        state.lastLateralTime = now;
        state.lastGestureTime = now;
        state.lastDetectedGesture = 'right';

        result.gesture = 'right';
        result.reason = 'Shifted right';
        result.debug.lateralState = state.lateralState;
        return result;
      }
    } else if (Math.abs(effectiveLateralX) <= config.lateralHysteresisThreshold) {
      // Hysteresis deadband: return to neutral
      if (state.lateralState !== 'NEUTRAL') {
        state.lateralState = 'NEUTRAL';
      }
    }
  }

  result.debug.jumpState = state.jumpState;
  result.debug.squatState = state.squatState;
  result.debug.lateralState = state.lateralState;
  return result;
}
