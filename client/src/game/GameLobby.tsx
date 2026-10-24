import React from 'react';
import {
  Activity,
  ArrowRight,
  Flame,
  Gamepad2,
  Play,
  RotateCcw,
  Smartphone,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';

export type GameId = 'runner' | 'tennis';

interface GameLobbyProps {
  onSelectGame: (gameId: GameId) => void;
  controllersCount: number;
  onOpenPairing: () => void;
}

export const GameLobby: React.FC<GameLobbyProps> = ({
  onSelectGame,
  controllersCount,
  onOpenPairing,
}) => {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 flex flex-col gap-8 select-none">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono tracking-wider">
              ARCADE SUITE v2.0
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
              2 MOTION GAMES AVAILABLE
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-2.5">
            Motion Arcade Hub <Sparkles className="w-7 h-7 text-amber-400" />
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Choose a game to play with your Android phone's gravity sensor, webcam pose detection, or keyboard!
          </p>
        </div>

        {/* Controller Status Indicator Card */}
        <div
          onClick={onOpenPairing}
          className="cursor-pointer bg-slate-900/90 hover:bg-slate-850 backdrop-blur-md p-3.5 rounded-2xl border border-slate-800 transition-all flex items-center gap-3.5 shadow-xl hover:border-cyan-500/50"
        >
          <div
            className={`p-2.5 rounded-xl border ${
              controllersCount > 0
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <span
                className={`w-2 h-2 rounded-full ${
                  controllersCount > 0 ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'
                }`}
              />
              <span>{controllersCount > 0 ? `${controllersCount} Phone Linked` : 'No Phone Connected'}</span>
            </div>
            <span className="text-[11px] text-cyan-400 underline font-medium">
              {controllersCount > 0 ? 'View Connection Details' : 'Tap to Pair Android Phone'}
            </span>
          </div>
        </div>
      </div>

      {/* Game Selection Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* GAME 1: Cyber Motion Dash (Endless Runner) */}
        <div className="group relative bg-gradient-to-b from-slate-900/90 to-slate-950/90 rounded-3xl p-6 border border-slate-800 hover:border-cyan-500/60 shadow-2xl transition-all duration-300 hover:shadow-cyan-500/10 flex flex-col justify-between overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/20 transition-all" />

          <div>
            {/* Badges & Category */}
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 rounded-full text-xs font-black tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase">
                2D Endless Runner
              </span>
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-400" /> High Speed
              </span>
            </div>

            {/* Title & Description */}
            <div className="flex items-start gap-3.5 mb-3">
              <div className="p-3 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/20 flex-shrink-0">
                <Zap className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white group-hover:text-cyan-300 transition-colors">
                  Cyber Motion Dash
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Dash across futuristic neon rooftops! Leap over laser hurdles, slide under high-voltage beams, collect energy cubes, and steer dynamically between 3 lanes.
                </p>
              </div>
            </div>

            {/* Feature Pills */}
            <div className="flex flex-wrap gap-1.5 my-4">
              {['3 Lanes', 'Dynamic Obstacles', 'Parallax City', 'High Scores', 'Power Physics'].map((badge) => (
                <span
                  key={badge}
                  className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-800/80 text-slate-300 border border-slate-700/60"
                >
                  {badge}
                </span>
              ))}
            </div>

            {/* Motion Controls Mapping */}
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 text-xs space-y-1.5 mb-6">
              <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" /> Motion Controls
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-slate-400">
                <div className="bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 text-center">
                  <span className="block text-cyan-300 font-bold">Tilt Phone</span>
                  <span>Steer Lanes</span>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 text-center">
                  <span className="block text-emerald-300 font-bold">Flick Up</span>
                  <span>Leap / Jump</span>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 text-center">
                  <span className="block text-indigo-300 font-bold">Flick Down</span>
                  <span>Slide / Squat</span>
                </div>
              </div>
            </div>
          </div>

          {/* Launch Button */}
          <button
            type="button"
            onClick={() => onSelectGame('runner')}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 group-hover:scale-[1.01]"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Play Cyber Runner</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* GAME 2: Grand Slam Tennis (2D Sports Simulation) */}
        <div className="group relative bg-gradient-to-b from-slate-900/90 to-slate-950/90 rounded-3xl p-6 border border-slate-800 hover:border-emerald-500/60 shadow-2xl transition-all duration-300 hover:shadow-emerald-500/10 flex flex-col justify-between overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/20 transition-all" />

          <div>
            {/* Badges & Category */}
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 rounded-full text-xs font-black tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase flex items-center gap-1">
                <span>🎾</span> 2D Tennis Arena
              </span>
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-400" /> Grand Slam Mode
              </span>
            </div>

            {/* Title & Description */}
            <div className="flex items-start gap-3.5 mb-3">
              <div className="p-3 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-slate-950 shadow-lg shadow-emerald-500/20 flex-shrink-0">
                <Trophy className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white group-hover:text-emerald-300 transition-colors">
                  Grand Slam Tennis
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Step onto the illuminated center court! Rally with an intelligent AI bot, unleash lightning power smashes, drop deceptive backhand slices, and chase match point!
                </p>
              </div>
            </div>

            {/* Feature Pills */}
            <div className="flex flex-wrap gap-1.5 my-4">
              {['3D Ball Physics', 'AI Opponent', 'Power Smashes', 'Drop Slices', 'Sound FX', 'Rally Streaks'].map((badge) => (
                <span
                  key={badge}
                  className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-800/80 text-slate-300 border border-slate-700/60"
                >
                  {badge}
                </span>
              ))}
            </div>

            {/* Motion Controls Mapping */}
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 text-xs space-y-1.5 mb-6">
              <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" /> Motion Controls
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-slate-400">
                <div className="bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 text-center">
                  <span className="block text-emerald-300 font-bold">Tilt Phone</span>
                  <span>Move Baseline</span>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 text-center">
                  <span className="block text-amber-300 font-bold">Flick Up</span>
                  <span>Power Smash 🔥</span>
                </div>
                <div className="bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 text-center">
                  <span className="block text-purple-300 font-bold">Flick Down</span>
                  <span>Topspin Slice 🎾</span>
                </div>
              </div>
            </div>
          </div>

          {/* Launch Button */}
          <button
            type="button"
            onClick={() => onSelectGame('tennis')}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 group-hover:scale-[1.01]"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Play Grand Slam Tennis</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Footer Info Box */}
      <div className="bg-slate-900/50 p-4 rounded-3xl border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>Both games support Phone Gravity Tilt, Camera Pose Landmarker, and Keyboard controls.</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <span>Keyboard: Left / Right (Steer), Space / Up (Jump/Smash), Down (Slide/Slice)</span>
        </div>
      </div>
    </div>
  );
};
