import { z } from 'zod';
import {
  MAX_PAYLOAD_BYTES,
  PROTOCOL_VERSION,
  type ClientHelloMessage,
  type ClientMessage,
  type GestureEventMessage,
  type SensorEventMessage,
  type ServerMessage,
  type ValidationResult,
} from './types.js';

// Base helper for finite numbers
const finiteNumber = z.number().finite();

// Client Hello Schema
export const ClientHelloSchema = z.object({
  version: z.literal(PROTOCOL_VERSION),
  type: z.literal('hello'),
  role: z.enum(['controller', 'game']),
  pairingToken: z.string().max(256).optional(),
  timestamp: finiteNumber.optional(),
}).strict();

// Gesture Event Schema
export const GestureEventSchema = z.object({
  version: z.literal(PROTOCOL_VERSION),
  timestamp: finiteNumber,
  type: z.literal('gesture'),
  gesture: z.enum(['jump', 'squat', 'left', 'right', 'neutral']),
  confidence: z.number().finite().min(0).max(1).optional(),
  source: z.enum(['camera', 'manual', 'sensor']),
}).strict();

// Sensor Event Schema
export const SensorEventSchema = z.object({
  version: z.literal(PROTOCOL_VERSION),
  timestamp: finiteNumber,
  type: z.literal('sensor'),
  tiltX: z.number().finite().min(-1).max(1),
  tiltY: z.number().finite().min(-1).max(1),
}).strict();

// Combined Client Message Schema (Discriminated Union on 'type')
export const ClientMessageSchema = z.discriminatedUnion('type', [
  ClientHelloSchema,
  GestureEventSchema,
  SensorEventSchema,
]);

// Server Connected Schema
export const ServerConnectedSchema = z.object({
  version: z.literal(PROTOCOL_VERSION),
  type: z.literal('connected'),
  clientId: z.string().min(1),
  role: z.enum(['controller', 'game']).optional(),
}).strict();

// Server Error Schema
export const ServerErrorSchema = z.object({
  version: z.literal(PROTOCOL_VERSION),
  type: z.literal('error'),
  code: z.string().min(1),
  message: z.string(),
}).strict();

// Server Peer Status Schema
export const ServerPeerStatusSchema = z.object({
  version: z.literal(PROTOCOL_VERSION),
  type: z.literal('peer_status'),
  controllersCount: finiteNumber.nonnegative(),
  gamesCount: finiteNumber.nonnegative(),
}).strict();

export const ServerMessageSchema = z.discriminatedUnion('type', [
  ServerConnectedSchema,
  ServerErrorSchema,
  ServerPeerStatusSchema,
  GestureEventSchema,
  SensorEventSchema,
]);

/**
 * Validates raw string or buffer into a typed ClientMessage.
 * Enforces max payload size, valid JSON, schema conformity, finite numbers.
 */
export function validateClientMessage(raw: unknown): ValidationResult<ClientMessage> {
  let text: string;

  if (typeof raw === 'string') {
    text = raw;
  } else if (raw instanceof Uint8Array || Buffer.isBuffer(raw)) {
    text = Buffer.from(raw).toString('utf-8');
  } else {
    return {
      success: false,
      code: 'INVALID_PAYLOAD_TYPE',
      error: 'Payload must be a string or byte buffer',
    };
  }

  // Check payload byte length
  const byteLength = typeof Buffer !== 'undefined'
    ? Buffer.byteLength(text, 'utf-8')
    : new TextEncoder().encode(text).length;

  if (byteLength > MAX_PAYLOAD_BYTES) {
    return {
      success: false,
      code: 'PAYLOAD_TOO_LARGE',
      error: `Payload exceeds limit of ${MAX_PAYLOAD_BYTES} bytes (got ${byteLength} bytes)`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      success: false,
      code: 'INVALID_JSON',
      error: 'Message contains invalid JSON',
    };
  }

  const result = ClientMessageSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    return {
      success: false,
      code: 'INVALID_MESSAGE_SCHEMA',
      error: issues || 'Failed message schema validation',
    };
  }

  return {
    success: true,
    data: result.data as ClientMessage,
  };
}

/**
 * Validates raw string or object into a typed ServerMessage.
 */
export function validateServerMessage(raw: unknown): ValidationResult<ServerMessage> {
  let parsed: unknown;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        success: false,
        code: 'INVALID_JSON',
        error: 'Message contains invalid JSON',
      };
    }
  } else {
    parsed = raw;
  }

  const result = ServerMessageSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    return {
      success: false,
      code: 'INVALID_SERVER_MESSAGE',
      error: issues,
    };
  }

  return {
    success: true,
    data: result.data as ServerMessage,
  };
}

/**
 * Helper to construct and serialize valid client messages.
 */
export function serializeMessage(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}
