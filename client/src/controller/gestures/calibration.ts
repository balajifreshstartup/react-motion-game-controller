import type {
  CalibrationData,
  NormalizedLandmark,
  PoseSummary,
} from './types.js';

// Landmark indices according to MediaPipe Pose Landmarker:
export const LANDMARK_INDEX = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

/**
 * Extracts a structured PoseSummary from raw MediaPipe landmarks.
 * Validates presence of essential torso and leg landmarks.
 */
export function extractPoseSummary(
  landmarks: NormalizedLandmark[] | undefined | null,
  timestamp: number = Date.now(),
  minConfidence: number = 0.5
): PoseSummary {
  if (!landmarks || landmarks.length < 27) {
    return createEmptySummary(timestamp);
  }

  const ls = landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
  const rs = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
  const lh = landmarks[LANDMARK_INDEX.LEFT_HIP];
  const rh = landmarks[LANDMARK_INDEX.RIGHT_HIP];
  const lk = landmarks[LANDMARK_INDEX.LEFT_KNEE];
  const rk = landmarks[LANDMARK_INDEX.RIGHT_KNEE];

  if (!ls || !rs || !lh || !rh) {
    return createEmptySummary(timestamp);
  }

  const confidences = [
    ls.visibility ?? 1,
    rs.visibility ?? 1,
    lh.visibility ?? 1,
    rh.visibility ?? 1,
    lk?.visibility ?? 1,
    rk?.visibility ?? 1,
  ];

  const lowestConf = Math.min(...confidences);
  if (lowestConf < minConfidence) {
    return {
      timestamp,
      isValid: false,
      minConfidence: lowestConf,
      hipY: (lh.y + rh.y) / 2,
      hipX: (lh.x + rh.x) / 2,
      shoulderY: (ls.y + rs.y) / 2,
      shoulderX: (ls.x + rs.x) / 2,
      kneeY: lk && rk ? (lk.y + rk.y) / 2 : (lh.y + rh.y) / 2 + 0.3,
      torsoCenterY: (lh.y + rh.y + ls.y + rs.y) / 4,
      torsoCenterX: (lh.x + rh.x + ls.x + rs.x) / 4,
      torsoHeight: Math.abs((lh.y + rh.y) / 2 - (ls.y + rs.y) / 2),
    };
  }

  const hipY = (lh.y + rh.y) / 2;
  const hipX = (lh.x + rh.x) / 2;
  const shoulderY = (ls.y + rs.y) / 2;
  const shoulderX = (ls.x + rs.x) / 2;
  const kneeY = lk && rk ? (lk.y + rk.y) / 2 : hipY + 0.3;
  const torsoCenterY = (hipY + shoulderY) / 2;
  const torsoCenterX = (hipX + shoulderX) / 2;
  const torsoHeight = Math.max(0.05, Math.abs(hipY - shoulderY));

  return {
    timestamp,
    isValid: true,
    minConfidence: lowestConf,
    hipY,
    hipX,
    shoulderY,
    shoulderX,
    kneeY,
    torsoCenterY,
    torsoCenterX,
    torsoHeight,
  };
}

function createEmptySummary(timestamp: number): PoseSummary {
  return {
    timestamp,
    isValid: false,
    minConfidence: 0,
    hipY: 0,
    hipX: 0,
    shoulderY: 0,
    shoulderX: 0,
    kneeY: 0,
    torsoCenterY: 0,
    torsoCenterX: 0,
    torsoHeight: 0,
  };
}

/**
 * Computes baseline calibration from a collection of neutral standing samples.
 */
export function computeCalibration(
  samples: PoseSummary[],
  minSamplesRequired: number = 15,
  maxAllowedStdDev: number = 0.08
): { success: true; calibration: CalibrationData } | { success: false; reason: string } {
  const validSamples = samples.filter((s) => s.isValid);

  if (validSamples.length < minSamplesRequired) {
    return {
      success: false,
      reason: `Insufficient valid samples. Needed ${minSamplesRequired}, got ${validSamples.length}. Ensure full body is visible.`,
    };
  }

  const hipYs = validSamples.map((s) => s.hipY);
  const centerXs = validSamples.map((s) => s.torsoCenterX);
  const heights = validSamples.map((s) => s.torsoHeight);
  const kneeYs = validSamples.map((s) => s.kneeY);
  const torsoYs = validSamples.map((s) => s.torsoCenterY);

  const meanHipY = average(hipYs);
  const stdDevHipY = standardDeviation(hipYs, meanHipY);

  if (stdDevHipY > maxAllowedStdDev) {
    return {
      success: false,
      reason: `Too much movement detected during calibration (std dev: ${stdDevHipY.toFixed(3)} > ${maxAllowedStdDev}). Please stand still.`,
    };
  }

  return {
    success: true,
    calibration: {
      isCalibrated: true,
      baselineHipY: meanHipY,
      baselineTorsoCenterY: average(torsoYs),
      baselineCenterX: average(centerXs),
      baselineTorsoHeight: average(heights),
      baselineKneeY: average(kneeYs),
      sampleCount: validSamples.length,
      calibratedAt: Date.now(),
    },
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function standardDeviation(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const squareDiffs = values.map((val) => Math.pow(val - mean, 2));
  const avgSquareDiff = average(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}
