export const PROTOCOL_VERSION = 1;
export const MAX_PAYLOAD_BYTES = 4096;

export type ClientRole = 'controller' | 'game';

export type GestureType = 'jump' | 'squat' | 'left' | 'right' | 'neutral';

export type GestureSource = 'camera' | 'manual' | 'sensor';

export interface ClientHelloMessage {
  version: 1;
  type: 'hello';
  role: ClientRole;
  pairingToken?: string;
  timestamp?: number;
}

export interface GestureEventMessage {
  version: 1;
  timestamp: number;
  type: 'gesture';
  gesture: GestureType;
  confidence?: number;
  source: GestureSource;
}

export interface SensorEventMessage {
  version: 1;
  timestamp: number;
  type: 'sensor';
  tiltX: number; // -1 to 1 (left to right)
  tiltY: number; // -1 to 1 (backward to forward)
}

export type ClientMessage = ClientHelloMessage | GestureEventMessage | SensorEventMessage;

export interface ServerConnectedMessage {
  version: 1;
  type: 'connected';
  clientId: string;
  role?: ClientRole;
}

export interface ServerErrorMessage {
  version: 1;
  type: 'error';
  code: string;
  message: string;
}

export interface ServerPeerStatusMessage {
  version: 1;
  type: 'peer_status';
  controllersCount: number;
  gamesCount: number;
}

export type ServerMessage = ServerConnectedMessage | ServerErrorMessage | ServerPeerStatusMessage | GestureEventMessage | SensorEventMessage;

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationFailure {
  success: false;
  code: string;
  error: string;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;
