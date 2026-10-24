export interface GestureConfig {
  minLandmarkConfidence: number;

  // Jump configuration
  // Remember: In screen coords, Y=0 is top and Y=1 is bottom.
  // Upward motion means negative deltaY (hipY - baselineHipY < -jumpThreshold).
  jumpThreshold: number;
  jumpLandingThreshold: number;
  jumpCooldownMs: number;

  // Squat configuration
  // Downward motion means positive deltaY (hipY - baselineHipY > squatThreshold).
  squatThreshold: number;
  squatResetThreshold: number;
  squatMinHoldMs: number;
  squatCooldownMs: number;

  // Lateral movement configuration (displacement of torso center X)
  lateralTriggerThreshold: number;
  lateralHysteresisThreshold: number;
  lateralCooldownMs: number;

  // Global refractory period between any two events
  globalRefractoryMs: number;
}

export const DEFAULT_GESTURE_CONFIG: GestureConfig = {
  minLandmarkConfidence: 0.55,

  // Jump
  jumpThreshold: 0.042,
  jumpLandingThreshold: 0.020,
  jumpCooldownMs: 450,

  // Squat
  squatThreshold: 0.045,
  squatResetThreshold: 0.022,
  squatMinHoldMs: 120,
  squatCooldownMs: 500,

  // Lateral movement (horizontal X)
  lateralTriggerThreshold: 0.055,
  lateralHysteresisThreshold: 0.028,
  lateralCooldownMs: 300,

  // Global refractory
  globalRefractoryMs: 180,
};

export type SensitivityLevel = 'low' | 'medium' | 'high';

export function getScaledConfig(base: GestureConfig, sensitivity: SensitivityLevel): GestureConfig {
  let scale = 1.0;
  if (sensitivity === 'low') scale = 1.35; // requires larger movements
  if (sensitivity === 'high') scale = 0.75; // requires smaller movements

  return {
    ...base,
    jumpThreshold: base.jumpThreshold * scale,
    jumpLandingThreshold: base.jumpLandingThreshold * scale,
    squatThreshold: base.squatThreshold * scale,
    squatResetThreshold: base.squatResetThreshold * scale,
    lateralTriggerThreshold: base.lateralTriggerThreshold * scale,
    lateralHysteresisThreshold: base.lateralHysteresisThreshold * scale,
  };
}
