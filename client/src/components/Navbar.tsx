import React from 'react';
import { Columns2, Gamepad2, Settings, Smartphone } from 'lucide-react';

export type AppMode = 'game' | 'controller' | 'dual';

interface NavbarProps {
  currentMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onSelectMode,
  onOpenSettings,
}) => {
  return (
    <nav className="w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-2.5 flex items-center justify-between z-30 select-none">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-black text-sm">
          🏃
        </div>
        <div>
          <span className="font-extrabold text-sm tracking-tight text-white">Motion Dash</span>
          <span className="hidden sm:inline-block ml-2 text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
            Controller MVP
          </span>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex items-center bg-slate-950/80 p-1 rounded-2xl border border-slate-800">
        <button
          type="button"
          onClick={() => onSelectMode('game')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            currentMode === 'game'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Gamepad2 className="w-3.5 h-3.5" />
          <span>Game</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectMode('controller')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            currentMode === 'controller'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Controller</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectMode('dual')}
          title="Side-by-side Game + Controller for local testing"
          className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            currentMode === 'dual'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Columns2 className="w-3.5 h-3.5" />
          <span>Dual Test</span>
        </button>
      </div>

      {/* Settings / Pairing Trigger */}
      <button
        type="button"
        onClick={onOpenSettings}
        className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/80 transition-colors shadow-sm"
        title="Pairing & Network Settings"
      >
        <Settings className="w-4 h-4" />
      </button>
    </nav>
  );
};
