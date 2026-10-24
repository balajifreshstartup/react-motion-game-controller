import type { GestureType, SensorEventMessage } from '@motion-game/protocol';

export type SensorSensitivity = 'low' | 'medium' | 'high';

export interface SensorTelemetry {
  tiltX: number;
  tiltY: number;
  gamma: number;
  beta: number;
  accelX: number;
  accelY: number;
  accelZ: number;
  lastGesture: GestureType | null;
  lastGestureTime: number;
  eventsCount: number;
  isCalibrated: boolean;
}

export interface SensorAdapterOptions {
  onSensorData: (event: SensorEventMessage) => void;
  onGesture?: (gesture: GestureType, confidence: number, source: 'sensor') => void;
  onTelemetry?: (telemetry: SensorTelemetry) => void;
  sampleRateHz?: number;
  deadzone?: number;
  sensitivity?: SensorSensitivity;
  enableFlicks?: boolean;
}

interface SensitivityThresholds {
  jumpAccel: number;      // m/s^2 linear accel or jerk
  slideAccel: number;     // m/s^2
  pitchJerkJump: number;  // deg/s pitch rate
  pitchJerkSlide: number; // deg/s pitch rate
  laneTiltTrigger: number;// tiltX threshold for snap lane switch
}

const SENSITIVITY_PROFILES: Record<SensorSensitivity, SensitivityThresholds> = {
  low: {
    jumpAccel: 9.5,
    slideAccel: -8.5,
    pitchJerkJump: -45,
    pitchJerkSlide: 45,
    laneTiltTrigger: 0.75,
  },
  medium: {
    jumpAccel: 7.0,
    slideAccel: -6.5,
    pitchJerkJump: -32,
    pitchJerkSlide: 32,
    laneTiltTrigger: 0.60,
  },
  high: {
    jumpAccel: 4.8,
    slideAccel: -4.5,
    pitchJerkJump: -22,
    pitchJerkSlide: 22,
    laneTiltTrigger: 0.45,
  },
};

export class SensorAdapter {
  private isListening = false;
  private onSensorData: (event: SensorEventMessage) => void;
  private onGesture?: (gesture: GestureType, confidence: number, source: 'sensor') => void;
  private onTelemetry?: (telemetry: SensorTelemetry) => void;

  private minIntervalMs: number;
  private lastEmitTime = 0;
  private deadzone: number;
  private sensitivity: SensorSensitivity;
  private enableFlicks: boolean;

  // Calibration neutral angles
  private neutralBeta = 42; // standard 40-45 degree natural viewing pitch
  private neutralGamma = 0;  // 0 degree standard flat horizontal roll
  private isCalibrated = false;

  // History for flick & gesture detection
  private lastBeta = 42;
  private lastBetaTime = 0;
  private lastGesture: GestureType | null = null;
  private lastGestureTime = 0;
  private gestureCooldownMs = 380; // Minimum time between flick triggers

  // Lane flick debounce
  private lastLaneGestureTime = 0;
  private laneCooldownMs = 320;
  private isLaneLatched = false;

  // Telemetry cache
  private telemetry: SensorTelemetry = {
    tiltX: 0,
    tiltY: 0,
    gamma: 0,
    beta: 0,
    accelX: 0,
    accelY: 0,
    accelZ: 0,
    lastGesture: null,
    lastGestureTime: 0,
    eventsCount: 0,
    isCalibrated: false,
  };

  private boundOrientationHandler: (e: DeviceOrientationEvent) => void;
  private boundMotionHandler: (e: DeviceMotionEvent) => void;

  constructor(options: SensorAdapterOptions) {
    this.onSensorData = options.onSensorData;
    this.onGesture = options.onGesture;
    this.onTelemetry = options.onTelemetry;
    const rate = options.sampleRateHz ?? 30; // 30Hz default
    this.minIntervalMs = 1000 / rate;
    this.deadzone = options.deadzone ?? 0.04;
    this.sensitivity = options.sensitivity ?? 'medium';
    this.enableFlicks = options.enableFlicks ?? true;

    this.boundOrientationHandler = this.handleOrientation.bind(this);
    this.boundMotionHandler = this.handleMotion.bind(this);
  }

  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      ('DeviceOrientationEvent' in window || 'DeviceMotionEvent' in window)
    );
  }

  public isSecureContext(): boolean {
    return typeof window !== 'undefined' && window.isSecureContext === true;
  }

  public async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false;

    // Check for iOS 13+ permission request
    const DeviceOrientation = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (typeof DeviceOrientation.requestPermission === 'function') {
      try {
        const state = await DeviceOrientation.requestPermission();
        return state === 'granted';
      } catch (err) {
        console.warn('[SensorAdapter] Permission request failed:', err);
        return false;
      }
    }

    return true;
  }

  public start(): boolean {
    if (this.isListening || !this.isSupported()) return false;

    window.addEventListener('deviceorientation', this.boundOrientationHandler, true);
    window.addEventListener('devicemotion', this.boundMotionHandler, true);
    this.isListening = true;
    return true;
  }

  public stop(): void {
    if (!this.isListening) return;

    window.removeEventListener('deviceorientation', this.boundOrientationHandler, true);
    window.removeEventListener('devicemotion', this.boundMotionHandler, true);
    this.isListening = false;
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  public setSensitivity(level: SensorSensitivity): void {
    this.sensitivity = level;
  }

  public setEnableFlicks(enable: boolean): void {
    this.enableFlicks = enable;
  }

  /**
   * Calibrate the current phone orientation as neutral (0,0)
   */
  public calibrateNeutral(customBeta?: number, customGamma?: number): void {
    this.neutralBeta = customBeta !== undefined ? customBeta : this.telemetry.beta;
    this.neutralGamma = customGamma !== undefined ? customGamma : this.telemetry.gamma;
    this.isCalibrated = true;
    this.telemetry.isCalibrated = true;
    this.dispatchTelemetry();
  }

  public resetCalibration(): void {
    this.neutralBeta = 42;
    this.neutralGamma = 0;
    this.isCalibrated = false;
    this.telemetry.isCalibrated = false;
    this.dispatchTelemetry();
  }

  private triggerGesture(gesture: GestureType, confidence = 0.92): void {
    const now = Date.now();
    this.lastGesture = gesture;
    this.lastGestureTime = now;
    this.telemetry.lastGesture = gesture;
    this.telemetry.lastGestureTime = now;

    // Trigger haptic vibration if supported
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(gesture === 'jump' ? [45] : [30, 20, 30]);
      } catch {
        // Ignore haptics errors
      }
    }

    if (this.onGesture) {
      this.onGesture(gesture, confidence, 'sensor');
    }
  }

  /**
   * Handle motion events (acceleration including gravity & jerk)
   */
  private handleMotion(event: DeviceMotionEvent): void {
    if (!this.enableFlicks) return;

    const now = Date.now();
    const thresholds = SENSITIVITY_PROFILES[this.sensitivity];

    // Read linear acceleration (excluding gravity) or calculate from accelerationIncludingGravity
    const accel = event.acceleration;
    const accelWithG = event.accelerationIncludingGravity;

    const ax = accel?.x ?? accelWithG?.x ?? 0;
    const ay = accel?.y ?? (accelWithG?.y ? accelWithG.y - 9.8 : 0);
    const az = accel?.z ?? accelWithG?.z ?? 0;

    this.telemetry.accelX = ax;
    this.telemetry.accelY = ay;
    this.telemetry.accelZ = az;
    this.telemetry.eventsCount++;

    // Upward flick -> Jump (Sudden positive Y jerk or negative Z flick forward)
    if (now - this.lastGestureTime > this.gestureCooldownMs) {
      if (ay > thresholds.jumpAccel || az < -thresholds.jumpAccel) {
        this.triggerGesture('jump', 0.95);
        return;
      }
      // Downward flick -> Squat / Slide
      if (ay < thresholds.slideAccel || az > -thresholds.slideAccel) {
        this.triggerGesture('squat', 0.95);
        return;
      }
    }
  }

  /**
   * Handle orientation events (gamma = roll / steer, beta = pitch / flick fallback)
   */
  private handleOrientation(event: DeviceOrientationEvent): void {
    const now = Date.now();
    const gamma = event.gamma ?? 0;
    const beta = event.beta ?? 42;

    this.telemetry.gamma = gamma;
    this.telemetry.beta = beta;
    this.telemetry.eventsCount++;

    const thresholds = SENSITIVITY_PROFILES[this.sensitivity];

    // Fallback flick detection using pitch angular velocity (useful if DeviceMotionEvent is unavailable)
    if (this.enableFlicks && this.lastBetaTime > 0) {
      const dt = (now - this.lastBetaTime) / 1000;
      if (dt > 0.01 && dt < 0.25) {
        const pitchRate = (beta - this.lastBeta) / dt; // deg/sec

        if (now - this.lastGestureTime > this.gestureCooldownMs) {
          // Sharp backward tilt (pitch up) -> Jump
          if (pitchRate < thresholds.pitchJerkJump) {
            this.triggerGesture('jump', 0.88);
          }
          // Sharp forward tilt (pitch down) -> Squat
          else if (pitchRate > thresholds.pitchJerkSlide) {
            this.triggerGesture('squat', 0.88);
          }
        }
      }
    }
    this.lastBeta = beta;
    this.lastBetaTime = now;

    // Calculate normalized steering and pitch tilt
    // Gamma delta from neutral: +/- 32 degrees represents full range [-1, 1]
    const deltaGamma = gamma - this.neutralGamma;
    let tiltX = deltaGamma / 32;

    // Beta delta from neutral: +/- 28 degrees represents range [-1, 1]
    const deltaBeta = beta - this.neutralBeta;
    let tiltY = deltaBeta / 28;

    // Clamp to [-1, 1]
    tiltX = Math.max(-1, Math.min(1, tiltX));
    tiltY = Math.max(-1, Math.min(1, tiltY));

    // Apply deadzone
    if (Math.abs(tiltX) < this.deadzone) tiltX = 0;
    if (Math.abs(tiltY) < this.deadzone) tiltY = 0;

    if (!Number.isFinite(tiltX)) tiltX = 0;
    if (!Number.isFinite(tiltY)) tiltY = 0;

    this.telemetry.tiltX = tiltX;
    this.telemetry.tiltY = tiltY;

    // Sharp tilt snap for lane switching
    if (this.enableFlicks) {
      if (Math.abs(tiltX) > thresholds.laneTiltTrigger) {
        if (!this.isLaneLatched && now - this.lastLaneGestureTime > this.laneCooldownMs) {
          this.isLaneLatched = true;
          this.lastLaneGestureTime = now;
          const direction = tiltX < 0 ? 'left' : 'right';
          this.triggerGesture(direction, 0.9);
        }
      } else if (Math.abs(tiltX) < thresholds.laneTiltTrigger * 0.5) {
        // Reset latch when phone returns closer to center
        this.isLaneLatched = false;
      }
    }

    // Rate-limit network emit to minIntervalMs (e.g. 30Hz)
    if (now - this.lastEmitTime >= this.minIntervalMs) {
      this.lastEmitTime = now;

      const sensorMsg: SensorEventMessage = {
        version: 1,
        timestamp: now,
        type: 'sensor',
        tiltX: Number(tiltX.toFixed(3)),
        tiltY: Number(tiltY.toFixed(3)),
      };

      this.onSensorData(sensorMsg);
      this.dispatchTelemetry();
    }
  }

  private dispatchTelemetry(): void {
    if (this.onTelemetry) {
      this.onTelemetry({ ...this.telemetry });
    }
  }

  public getTelemetry(): SensorTelemetry {
    return { ...this.telemetry };
  }
}
