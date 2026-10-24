import { describe, expect, it, vi } from 'vitest';
import type { GestureType, SensorEventMessage } from '@motion-game/protocol';
import { SensorAdapter } from '../src/controller/sensors/sensorAdapter.js';

describe('SensorAdapter & Handheld Gravity Engine', () => {
  it('initializes with default settings and reports support', () => {
    const onSensorData = vi.fn();
    const adapter = new SensorAdapter({ onSensorData });

    expect(adapter).toBeDefined();
    expect(adapter.getIsListening()).toBe(false);
  });

  it('normalizes gamma and beta into tiltX and tiltY with deadzone', () => {
    const sensorEvents: SensorEventMessage[] = [];
    const adapter = new SensorAdapter({
      onSensorData: (e) => sensorEvents.push(e),
      sampleRateHz: 60,
      deadzone: 0.05,
    });

    adapter.start();

    // Trigger deviceorientation with mild tilt
    // gamma = 16 deg (out of 32 deg range) -> tiltX ~ 0.5
    // beta = 42 deg (neutral pitch) -> tiltY ~ 0
    const orientationHandler = (adapter as unknown as { boundOrientationHandler: (e: unknown) => void }).boundOrientationHandler;

    orientationHandler({ gamma: 16, beta: 42 });

    expect(sensorEvents.length).toBeGreaterThan(0);
    const last = sensorEvents[sensorEvents.length - 1];
    expect(last.tiltX).toBeCloseTo(0.5, 1);
    expect(last.tiltY).toBe(0);

    adapter.stop();
  });

  it('detects upward flick jump from device acceleration', () => {
    const gestures: GestureType[] = [];
    const adapter = new SensorAdapter({
      onSensorData: () => {},
      onGesture: (g) => gestures.push(g),
      sensitivity: 'medium',
      enableFlicks: true,
    });

    adapter.start();

    const motionHandler = (adapter as unknown as { boundMotionHandler: (e: unknown) => void }).boundMotionHandler;

    // Simulate sudden upward acceleration jerk: ay > 7.0 m/s^2
    motionHandler({
      acceleration: { x: 0, y: 12.5, z: 0 },
      accelerationIncludingGravity: null,
    });

    expect(gestures).toContain('jump');
    adapter.stop();
  });

  it('detects downward flick slide from device acceleration', () => {
    const gestures: GestureType[] = [];
    const adapter = new SensorAdapter({
      onSensorData: () => {},
      onGesture: (g) => gestures.push(g),
      sensitivity: 'medium',
      enableFlicks: true,
    });

    adapter.start();

    const motionHandler = (adapter as unknown as { boundMotionHandler: (e: unknown) => void }).boundMotionHandler;

    // Simulate sudden downward acceleration jerk: ay < -6.5 m/s^2
    motionHandler({
      acceleration: { x: 0, y: -9.5, z: 0 },
      accelerationIncludingGravity: null,
    });

    expect(gestures).toContain('squat');
    adapter.stop();
  });

  it('calibrates neutral angle properly', () => {
    const sensorEvents: SensorEventMessage[] = [];
    const adapter = new SensorAdapter({
      onSensorData: (e) => sensorEvents.push(e),
      sampleRateHz: 60,
      deadzone: 0.02,
    });

    adapter.start();

    const orientationHandler = (adapter as unknown as { boundOrientationHandler: (e: unknown) => void }).boundOrientationHandler;

    // Phone is held at a custom angle: gamma = 10, beta = 60
    orientationHandler({ gamma: 10, beta: 60 });

    // Calibrate this current angle as (0, 0)
    adapter.calibrateNeutral(60, 10);

    sensorEvents.length = 0;
    // Sending the same angle now results in 0 tilt!
    // Reset lastEmitTime to allow immediate second sample past throttle
    (adapter as unknown as { lastEmitTime: number }).lastEmitTime = 0;
    orientationHandler({ gamma: 10, beta: 60 });

    expect(sensorEvents.length).toBeGreaterThan(0);
    const last = sensorEvents[sensorEvents.length - 1];
    expect(last.tiltX).toBe(0);
    expect(last.tiltY).toBe(0);

    adapter.stop();
  });
});
