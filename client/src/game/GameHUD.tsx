import React from 'react';
import { Activity, Award, Flame, Heart, Play, Pause, RotateCcw, Smartphone, Zap } from 'lucide-react';
import type { GameState, GameStats } from './types.js';

interface GameHUDProps {
  stats: GameStats;
  gameState: GameState;
  lastGesture: string | null;
  controllersCount: number;
  tiltX: number;
  onPauseToggle: () => void;
  onRestart: () => void;
  onOpenPairing: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  stats,
  gameState,
  lastGesture,
  controllersCount,
  tiltX,
  onPauseToggle,
  onRestart,
  onOpenPairing,
}) => {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-6 select-none">
      {/* Top Bar: Connection Status, Score, High Score */}
      <div className="flex items-center justify-between pointer-events-auto gap-4">
        {/* Left: Controller Status Badge */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenPairing}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md transition-all shadow-lg border ${
              controllersCount > 0
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
            }`}
          >
            <Smartphone className="w-4 h-4 animate-pulse" />
            <span>
              {controllersCount > 0
                ? `${controllersCount} Phone${controllersCount > 1 ? 's' : ''} Connected`
                : 'Pair Phone Controller'}
            </span>
          </button>

          {/* Lives (Hearts) */}
          <div className="flex items-center gap-1 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/50">
            {[1, 2, 3].map((heartIndex) => (
              <Heart
                key={heartIndex}
                className={`w-4 h-4 transition-all ${
                  heartIndex <= stats.lives
                    ? 'text-rose-500 fill-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                    : 'text-slate-600'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Center: Live Gesture Indicator */}
        {lastGesture && (
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-300 font-bold text-sm tracking-wider uppercase animate-bounce shadow-[0_0_15px_rgba(6,182,212,0.4)]">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>{lastGesture}</span>
          </div>
        )}

        {/* Right: Scores & Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 bg-slate-900/70 backdrop-blur-md px-4 py-1.5 rounded-xl border border-slate-800 shadow-xl">
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Score</span>
              <span className="text-xl font-extrabold text-cyan-400 font-mono tracking-tight">
                {stats.score.toLocaleString()}
              </span>
            </div>

            <div className="h-6 w-px bg-slate-700/50" />

            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" />
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Best</span>
                <span className="text-sm font-bold text-amber-300 font-mono">
                  {stats.highScore.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={onPauseToggle}
              title="Pause Game (P)"
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-white transition-all shadow-md"
            >
              {gameState === 'PAUSED' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              onClick={onRestart}
              title="Restart Game (Enter)"
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-white transition-all shadow-md"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Multiplier, Tilt Angle, Keyboard Legend */}
      <div className="flex items-end justify-between pointer-events-auto">
        {/* Left: Speed / Multiplier indicator */}
        <div className="flex items-center gap-3 bg-slate-900/60 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-800 text-xs">
          <div className="flex items-center gap-1 text-amber-400 font-semibold">
            <Flame className="w-4 h-4" />
            <span>{stats.multiplier}x Speed</span>
          </div>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400 font-mono">{stats.distance}m</span>

          {/* Tilt angle meter */}
          {Math.abs(tiltX) > 0.05 && (
            <>
              <span className="text-slate-500">•</span>
              <div className="flex items-center gap-1 text-cyan-300 font-mono">
                <Activity className="w-3.5 h-3.5" />
                <span>Tilt: {tiltX > 0 ? `+${(tiltX * 100).toFixed(0)}%` : `${(tiltX * 100).toFixed(0)}%`}</span>
              </div>
            </>
          )}
        </div>

        {/* Right: Controls Help Legend */}
        <div className="hidden md:flex items-center gap-2 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-400">
          <span>Keyboard:</span>
          <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono">Space/↑</kbd> Jump
          <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono">↓</kbd> Squat
          <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono">←/→</kbd> Lane
        </div>
      </div>
    </div>
  );
};
