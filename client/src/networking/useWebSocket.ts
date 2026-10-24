import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PROTOCOL_VERSION,
  serializeMessage,
  validateServerMessage,
  type ClientMessage,
  type ClientRole,
  type GestureEventMessage,
  type SensorEventMessage,
  type ServerMessage,
} from '@motion-game/protocol';

export type ConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'ERROR';

export interface UseWebSocketOptions {
  url?: string;
  role: ClientRole;
  pairingToken?: string;
  autoConnect?: boolean;
  onGesture?: (gesture: GestureEventMessage) => void;
  onSensor?: (sensor: SensorEventMessage) => void;
}

export function getDefaultWsUrl(): string {
  // If Vite env defined:
  const envUrl = import.meta.env.VITE_WS_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim();
  }

  // Derive from current location
  if (typeof window !== 'undefined') {
    const isHttps = window.location.protocol === 'https:';
    const host = window.location.hostname || 'localhost';
    if (isHttps) {
      // Connect through Vite's HTTPS WebSocket proxy to avoid mixed content errors
      return `wss://${host}:${window.location.port || '5173'}/ws`;
    }
    return `ws://${host}:8080`;
  }
  return 'ws://localhost:8080';
}

export function useWebSocket(options: UseWebSocketOptions) {
  const {
    url = getDefaultWsUrl(),
    role,
    pairingToken,
    autoConnect = true,
    onGesture,
    onSensor,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [controllersCount, setControllersCount] = useState<number>(0);
  const [gamesCount, setGamesCount] = useState<number>(0);
  const [lastGesture, setLastGesture] = useState<GestureEventMessage | null>(null);
  const [lastSensor, setLastSensor] = useState<SensorEventMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isManuallyClosedRef = useRef<boolean>(false);

  // Store callbacks in refs to avoid reconnection loops on state changes
  const onGestureRef = useRef(onGesture);
  onGestureRef.current = onGesture;
  const onSensorRef = useRef(onSensor);
  onSensorRef.current = onSensor;

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    isManuallyClosedRef.current = false;
    setStatus(reconnectAttemptsRef.current > 0 ? 'RECONNECTING' : 'CONNECTING');
    setErrorMessage(null);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('CONNECTED');
        reconnectAttemptsRef.current = 0;
        setErrorMessage(null);

        // Send Hello Message
        const helloMsg: ClientMessage = {
          version: PROTOCOL_VERSION,
          type: 'hello',
          role,
          pairingToken: pairingToken && pairingToken.trim().length > 0 ? pairingToken.trim() : undefined,
          timestamp: Date.now(),
        };
        ws.send(serializeMessage(helloMsg));
      };

      ws.onmessage = (event) => {
        const validation = validateServerMessage(event.data);
        if (!validation.success) {
          console.warn('[WS] Received invalid server message:', validation.error);
          return;
        }

        const msg: ServerMessage = validation.data;
        switch (msg.type) {
          case 'connected':
            setClientId(msg.clientId);
            break;
          case 'error':
            console.error('[WS Server Error]:', msg.code, msg.message);
            setErrorMessage(`Server: ${msg.message} (${msg.code})`);
            break;
          case 'peer_status':
            setControllersCount(msg.controllersCount);
            setGamesCount(msg.gamesCount);
            break;
          case 'gesture':
            setLastGesture(msg);
            onGestureRef.current?.(msg);
            break;
          case 'sensor':
            setLastSensor(msg);
            onSensorRef.current?.(msg);
            break;
        }
      };

      ws.onerror = () => {
        setStatus('ERROR');
        setErrorMessage(`Failed to connect to ${url}`);
      };

      ws.onclose = (event) => {
        wsRef.current = null;
        if (!isManuallyClosedRef.current) {
          setStatus('DISCONNECTED');
          // Exponential backoff reconnect: 1s, 2s, 4s, capped at 8s
          const delay = Math.min(8000, 1000 * Math.pow(1.5, reconnectAttemptsRef.current));
          reconnectAttemptsRef.current++;
          console.log(`[WS] Connection lost. Attempting reconnect in ${Math.round(delay)}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setStatus('DISCONNECTED');
        }
      };
    } catch (err: any) {
      setStatus('ERROR');
      setErrorMessage(err?.message || 'WebSocket creation error');
    }
  }, [url, role, pairingToken]);

  const disconnect = useCallback(() => {
    isManuallyClosedRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('DISCONNECTED');
  }, []);

  const sendMessage = useCallback((msg: ClientMessage): boolean => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(serializeMessage(msg));
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    status,
    errorMessage,
    clientId,
    controllersCount,
    gamesCount,
    lastGesture,
    lastSensor,
    connect,
    disconnect,
    sendMessage,
    url,
  };
}
