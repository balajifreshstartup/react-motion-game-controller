import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { GestureEventMessage, SensorEventMessage } from '@motion-game/protocol';
import { useWebSocket } from '../networking/useWebSocket.js';
import { GameEngine } from './GameEngine.js';
import { GameHUD } from './GameHUD.js';
import type { GameState, GameStats } from './types.js';

interface GameCanvasProps {
  wsUrl?: string;
  pairingToken?: string;
  onOpenPairing: () => void;
  onBackToLobby?: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  wsUrl,
  pairingToken,
  onOpenPairing,
  onBackToLobby,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>('START');
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    highScore: 0,
    distance: 0,
    coins: 0,
    multiplier: 1.0,
    lives: 3,
    speed: 340,
  });
  const [lastGestureText, setLastGestureText] = useState<string | null>(null);
  const [tiltX, setTiltX] = useState<number>(0);
  const gestureTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Incoming Gesture Handler from WebSocket
  const handleRemoteGesture = useCallback((msg: GestureEventMessage) => {
    if (engineRef.current) {
      engineRef.current.handleGesture(msg.gesture);
    }
  }, []);

  // Incoming Sensor Handler from WebSocket
  const handleRemoteSensor = useCallback((msg: SensorEventMessage) => {
    setTiltX(msg.tiltX);
    if (engineRef.current) {
      engineRef.current.handleTilt(msg.tiltX, msg.tiltY);
    }
  }, []);

  // WebSocket client connected as 'game'
  const { controllersCount, status: wsStatus } = useWebSocket({
    url: wsUrl,
    role: 'game',
    pairingToken,
    onGesture: handleRemoteGesture,
    onSensor: handleRemoteSensor,
  });

  const showGestureFeedback = useCallback((text: string) => {
    setLastGestureText(text);
    if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
    gestureTimeoutRef.current = setTimeout(() => {
      setLastGestureText(null);
    }, 1200);
  }, []);

  // Initialize Canvas and GameEngine
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine(canvasRef.current, {
      onStatsUpdate: (newStats) => {
        setStats(newStats);
      },
      onStateChange: (newState) => {
        setGameState(newState);
      },
      onGestureFeedback: showGestureFeedback,
    });

    engineRef.current = engine;

    const handleResize = () => {
      engine.resizeCanvas();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      engine.destroy();
      engineRef.current = null;
    };
  }, [showGestureFeedback]);

  const handlePauseToggle = () => {
    engineRef.current?.pause();
  };

  const handleRestart = () => {
    engineRef.current?.restart();
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950 overflow-hidden">
      {/* Game Canvas Container */}
      <div className="relative w-full h-full max-w-6xl max-h-[720px] aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
        <canvas
          ref={canvasRef}
          className="w-full h-full block touch-none cursor-pointer"
          onClick={() => {
            if (gameState === 'START' || gameState === 'GAMEOVER') {
              handleRestart();
            }
          }}
        />

        {/* HUD Overlay */}
        <GameHUD
          stats={stats}
          gameState={gameState}
          lastGesture={lastGestureText}
          controllersCount={controllersCount}
          tiltX={tiltX}
          onPauseToggle={handlePauseToggle}
          onRestart={handleRestart}
          onOpenPairing={onOpenPairing}
          onBackToLobby={onBackToLobby}
        />
      </div>
    </div>
  );
};
