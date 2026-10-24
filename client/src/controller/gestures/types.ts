import type { GestureType } from '@motion-game/protocol';

export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
}

export interface PoseLandmarksData {
  landmarks: NormalizedLandmark[];
  timestamp: number;
}

export interface PoseSummary {
  timestamp: number;
  isValid: boolean;
  minConfidence: number;
  hipY: number;
  hipX: number;
  shoulderY: number;
  shoulderX: number;
  kneeY: number;
  torsoCenterY: number;
  torsoCenterX: number;
  torsoHeight: number;
}

export interface CalibrationData {
  isCalibrated: boolean;
  baselineHipY: number;
  baselineTorsoCenterY: number;
  baselineCenterX: number;
  baselineTorsoHeight: number;
  baselineKneeY: number;
  sampleCount: number;
  calibratedAt: number;
}

export type JumpState = 'GROUNDED' | 'AIRBORNE' | 'COOLDOWN';
export type SquatState = 'STANDING' | 'PRE_SQUAT' | 'SQUATTING';
export type LateralState = 'NEUTRAL' | 'LEFT' | 'RIGHT';

export interface GestureDetectorState {
  jumpState: JumpState;
  lastJumpTime: number;
  airborneFrames: number;

  squatState: SquatState;
  squatStartTime: number;
  lastSquatTriggerTime: number;

  lateralState: LateralState;
  lastLateralTime: number;

  lastGestureTime: number;
  lastDetectedGesture: GestureType | null;
}

export interface GestureDetectionResult {
  gesture: GestureType | null;
  confidence: number;
  reason?: string;
  debug: {
    hipDisplacementY: number;
    squatRatio: number;
    lateralDisplacementX: number;
    jumpState: JumpState;
    squatState: SquatState;
    lateralState: LateralState;
  };
}
