import { describe, expect, it } from 'vitest';
import {
  MAX_PAYLOAD_BYTES,
  PROTOCOL_VERSION,
  serializeMessage,
  validateClientMessage,
  validateServerMessage,
  type GestureEventMessage,
  type SensorEventMessage,
} from '../src/index.js';

describe('Protocol Validation', () => {
  it('accepts valid hello message', () => {
    const raw = JSON.stringify({
      version: PROTOCOL_VERSION,
      type: 'hello',
      role: 'controller',
      pairingToken: 'secret123',
    });
    const result = validateClientMessage(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('hello');
      if (result.data.type === 'hello') {
        expect(result.data.role).toBe('controller');
        expect(result.data.pairingToken).toBe('secret123');
      }
    }
  });

  it('accepts valid gesture message', () => {
    const msg: GestureEventMessage = {
      version: 1,
      timestamp: Date.now(),
      type: 'gesture',
      gesture: 'jump',
      confidence: 0.95,
      source: 'camera',
    };
    const result = validateClientMessage(JSON.stringify(msg));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(msg);
    }
  });

  it('accepts manual and sensor gesture sources', () => {
    const manualMsg = {
      version: 1,
      timestamp: Date.now(),
      type: 'gesture',
      gesture: 'squat',
      source: 'manual',
    };
    expect(validateClientMessage(JSON.stringify(manualMsg)).success).toBe(true);
  });

  it('accepts valid sensor message with clamped coordinates', () => {
    const sensorMsg: SensorEventMessage = {
      version: 1,
      timestamp: Date.now(),
      type: 'sensor',
      tiltX: -0.85,
      tiltY: 0.45,
    };
    const result = validateClientMessage(JSON.stringify(sensorMsg));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(sensorMsg);
    }
  });

  it('rejects invalid JSON', () => {
    const result = validateClientMessage('{ broken json ...');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('INVALID_JSON');
    }
  });

  it('rejects unsupported protocol version', () => {
    const result = validateClientMessage(
      JSON.stringify({
        version: 99,
        type: 'hello',
        role: 'game',
      })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('INVALID_MESSAGE_SCHEMA');
    }
  });

  it('rejects unknown gesture name', () => {
    const result = validateClientMessage(
      JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        type: 'gesture',
        gesture: 'cartwheel', // invalid
        source: 'camera',
      })
    );
    expect(result.success).toBe(false);
  });

  it('rejects unknown message type', () => {
    const result = validateClientMessage(
      JSON.stringify({
        version: 1,
        type: 'unsupported_event',
      })
    );
    expect(result.success).toBe(false);
  });

  it('rejects out-of-range confidence', () => {
    const negativeConf = validateClientMessage(
      JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        type: 'gesture',
        gesture: 'jump',
        confidence: -0.1,
        source: 'camera',
      })
    );
    expect(negativeConf.success).toBe(false);

    const excessiveConf = validateClientMessage(
      JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        type: 'gesture',
        gesture: 'jump',
        confidence: 1.5,
        source: 'camera',
      })
    );
    expect(excessiveConf.success).toBe(false);
  });

  it('rejects out-of-range tilt coordinates', () => {
    const result = validateClientMessage(
      JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        type: 'sensor',
        tiltX: 1.25, // must be <= 1
        tiltY: 0,
      })
    );
    expect(result.success).toBe(false);
  });

  it('rejects non-finite numbers (NaN, Infinity)', () => {
    const rawWithInfinity = '{"version":1,"timestamp":100,"type":"sensor","tiltX":"NaN","tiltY":0}';
    expect(validateClientMessage(rawWithInfinity).success).toBe(false);
  });

  it('rejects oversized payload (> 4KB)', () => {
    const hugePadding = 'a'.repeat(MAX_PAYLOAD_BYTES + 100);
    const oversized = JSON.stringify({
      version: 1,
      type: 'hello',
      role: 'controller',
      pairingToken: hugePadding,
    });
    const result = validateClientMessage(oversized);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('PAYLOAD_TOO_LARGE');
    }
  });

  it('validates server messages correctly', () => {
    const connMsg = {
      version: 1,
      type: 'connected',
      clientId: 'abc-123',
      role: 'game',
    };
    expect(validateServerMessage(connMsg).success).toBe(true);

    const errorMsg = {
      version: 1,
      type: 'error',
      code: 'UNAUTHORIZED',
      message: 'Bad token',
    };
    expect(validateServerMessage(errorMsg).success).toBe(true);

    const peerMsg = {
      version: 1,
      type: 'peer_status',
      controllersCount: 1,
      gamesCount: 2,
    };
    expect(validateServerMessage(peerMsg).success).toBe(true);
  });
});
