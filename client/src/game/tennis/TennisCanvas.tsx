import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Flame,
  LayoutGrid,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import type { GestureEventMessage, SensorEventMessage } from '@motion-game/protocol';
import { useWebSocket } from '../../networking/useWebSocket.js';
import { tennisAudio } from './tennisAudio.js';
import { TennisEngine } from './TennisEngine.js';
import type { TennisGameState, TennisStats } from './types.js';

interface TennisCanvasProps {
  wsUrl?: string;
  pairingToken?: string;
  onOpenPairing: () => void;
  onBackToLobby: () => void;
}

export const TennisCanvas: React.FC<TennisCanvasProps> = ({
  wsUrl,
  pairingToken,
  onOpenPairing,
  onBackToLobby,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<TennisEngine | null>(null);

  const [gameState, setGameState] = useState<TennisGameState>('SERVE_PLAYER');
  const [stats, setStats] = useState<TennisStats>({
    scoreText: 'LOVE - LOVE',
    gameScoreText: 'GAMES: 0 - 0',
    rallyCount: 0,
    bestRally: 0,
    playerGames: 0,
    aiGames: 0,
    lastShotType: null,
    server: 'player',
    speedMode: 'relaxed',
  });
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Incoming Gesture Handler from WebSocket
  const handleRemoteGesture = useCallback((msg: GestureEventMessage) => {
    if (engineRef.current) {
      engineRef.current.handleGesture(msg.gesture);
    }
  }, []);

  // Incoming Sensor Handler from WebSocket
  const handleRemoteSensor = useCallback((msg: SensorEventMessage) => {
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

  const showFeedback = useCallback((text: string) => {
    setLastFeedback(text);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      setLastFeedback(null);
    }, 1800);
  }, []);

  // Initialize Tennis Engine
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new TennisEngine(canvasRef.current, {
      onStatsUpdate: (newStats) => setStats(newStats),
      onStateChange: (newState) => setGameState(newState),
      onFeedback: showFeedback,
    });

    engineRef.current = engine;
    engine.start();

    const handleResize = () => {
      engine.resizeCanvas();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      engine.destroy();
      engineRef.current = null;
    };
  }, [showFeedback]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    tennisAudio.setMuted(next);
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center select-none overflow-hidden bg-slate-950">
      {/* Top Header / Scoreboard HUD */}
      <div className="w-full max-w-4xl px-4 py-2 flex items-center justify-between z-20">
        {/* Back to Lobby Button */}
        <button
          type="button"
          onClick={onBackToLobby}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition-all shadow-md"
        >
          <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" />
          <span>Change Game</span>
        </button>

        {/* Grand Slam Stadium Digital Scoreboard */}
        <div className="flex items-center gap-4 bg-slate-900/90 backdrop-blur-md px-5 py-1.5 rounded-2xl border border-slate-700/80 shadow-2xl">
          {/* Player Score */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
              PLAYER {stats.server === 'player' ? '🎾' : ''}
            </span>
            <span className="text-base font-black text-white font-mono tracking-wider">
              {stats.scoreText.split('-')[0].trim()}
            </span>
          </div>

          <div className="text-slate-600 font-bold text-sm">VS</div>

          {/* AI Score */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">
              AI BOT {stats.server === 'ai' ? '🎾' : ''}
            </span>
            <span className="text-base font-black text-white font-mono tracking-wider">
              {stats.scoreText.split('-')[1]?.trim() || 'LOVE'}
            </span>
          </div>

          <div className="h-6 w-px bg-slate-800" />

          {/* Sets & Rally Streak */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1 text-amber-400 font-bold">
              <Trophy className="w-3.5 h-3.5" />
              <span>{stats.gameScoreText}</span>
            </div>

            {stats.rallyCount > 0 && (
              <div className="flex items-center gap-1 text-cyan-300 font-bold">
                <Flame className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
                <span>Rally: {stats.rallyCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-2">
          {/* Speed Toggle Button */}
          <button
            type="button"
            onClick={() => {
              const nextMode =
                stats.speedMode === 'relaxed'
                  ? 'normal'
                  : stats.speedMode === 'normal'
                  ? 'fast'
                  : 'relaxed';
              engineRef.current?.setSpeedMode(nextMode);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition-all shadow-md"
            title="Adjust Ball Speed (Relaxed / Normal / Fast)"
          >
            <span>
              {stats.speedMode === 'relaxed'
                ? '🐢 Relaxed'
                : stats.speedMode === 'normal'
                ? '⚡ Normal'
                : '🔥 Fast'}
            </span>
          </button>

          {/* Mute Button */}
          <button
            type="button"
            onClick={toggleMute}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-xs transition-colors"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {/* Controller connection badge */}
          <button
            type="button"
            onClick={onOpenPairing}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
              controllersCount > 0
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                controllersCount > 0 ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'
              }`}
            />
            <span>{controllersCount > 0 ? 'Controller Linked' : 'Connect Phone'}</span>
          </button>
        </div>
      </div>

      {/* Main Tennis Canvas Area */}
      <div className="relative flex-1 w-full max-w-4xl max-h-[640px] flex items-center justify-center rounded-3xl overflow-hidden border border-slate-800/80 shadow-2xl bg-slate-950">
        <canvas ref={canvasRef} className="w-full h-full block cursor-pointer" />

        {/* Big Serve / Hit Prompt when Waiting */}
        {gameState === 'SERVE_PLAYER' && (
          <div className="absolute bottom-20 z-10 pointer-events-none">
            <div className="bg-cyan-500/90 text-slate-950 font-black px-6 py-2.5 rounded-full text-sm uppercase tracking-widest shadow-[0_0_25px_rgba(6,182,212,0.6)] animate-bounce flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>Tap Screen, Space, or Flick Phone to Serve!</span>
            </div>
          </div>
        )}

        {/* Active Feedback Banner */}
        {lastFeedback && (
          <div className="absolute top-16 z-10 pointer-events-none animate-fade-in">
            <div className="bg-slate-900/90 backdrop-blur-md border border-cyan-500/50 text-cyan-300 font-black px-5 py-2 rounded-2xl text-base uppercase tracking-wider shadow-xl">
              {lastFeedback}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls Helper & On-screen Action Bar */}
      <div className="w-full max-w-4xl px-4 py-2.5 flex items-center justify-between text-xs text-slate-400 z-20">
        {/* Controls Cheatsheet */}
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span className="flex items-center gap-1 text-slate-300">
            <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-bold">Tilt</span>
            Move Baseline
          </span>
          <span className="flex items-center gap-1 text-slate-300">
            <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300 font-bold">Flick Up</span>
            Power Smash 🔥
          </span>
          <span className="flex items-center gap-1 text-slate-300">
            <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-purple-300 font-bold">Flick Down</span>
            Topspin Slice 🎾
          </span>
        </div>

        {/* Quick Clickable Buttons for Testing & Hybrid Play */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => engineRef.current?.handleGesture('jump')}
            className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 font-bold text-xs flex items-center gap-1 transition-all active:scale-95"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>Smash</span>
          </button>

          <button
            type="button"
            onClick={() => engineRef.current?.handleGesture('squat')}
            className="px-3 py-1 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 font-bold text-xs flex items-center gap-1 transition-all active:scale-95"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>Slice</span>
          </button>

          <button
            type="button"
            onClick={() => engineRef.current?.triggerServeOrSwing()}
            className="px-4 py-1 rounded-xl bg-cyan-500 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95 hover:bg-cyan-400"
          >
            Hit / Serve
          </button>
        </div>
      </div>
    </div>
  );
};
