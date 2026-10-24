import React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import type { GestureType } from '@motion-game/protocol';

interface ManualControlsProps {
  onTriggerGesture: (gesture: GestureType) => void;
  disabled?: boolean;
}

export const ManualControls: React.FC<ManualControlsProps> = ({
  onTriggerGesture,
  disabled = false,
}) => {
  const handlePress = (gesture: GestureType) => {
    if (disabled) return;
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(25);
      }
    } catch {
      // Haptics not allowed
    }
    onTriggerGesture(gesture);
  };

  return (
    <div className="w-full flex flex-col items-center gap-2 p-2 select-none">
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        <span>Manual Controls (Touch Fallback)</span>
      </div>

      <div className="grid grid-cols-3 gap-2.5 w-full max-w-xs">
        {/* Top: Jump */}
        <div className="col-start-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handlePress('jump')}
            className="w-full h-16 rounded-2xl bg-gradient-to-b from-cyan-500 to-cyan-600 active:from-cyan-600 active:to-cyan-700 text-white font-extrabold flex flex-col items-center justify-center gap-1 shadow-lg shadow-cyan-500/25 border border-cyan-400 active:scale-95 transition-all touch-manipulation"
          >
            <ArrowUp className="w-6 h-6" />
            <span className="text-xs uppercase tracking-wide">Jump</span>
          </button>
        </div>

        {/* Middle Row: Left, Neutral/Squat, Right */}
        <div className="col-start-1 col-span-3 grid grid-cols-3 gap-2.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handlePress('left')}
            className="h-16 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 active:from-slate-700 active:to-slate-800 text-slate-100 font-extrabold flex flex-col items-center justify-center gap-1 shadow-md border border-slate-700 active:scale-95 transition-all touch-manipulation"
          >
            <ArrowLeft className="w-6 h-6" />
            <span className="text-xs uppercase tracking-wide">Left</span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => handlePress('squat')}
            className="h-16 rounded-2xl bg-gradient-to-b from-indigo-500 to-indigo-600 active:from-indigo-600 active:to-indigo-700 text-white font-extrabold flex flex-col items-center justify-center gap-1 shadow-lg shadow-indigo-500/25 border border-indigo-400 active:scale-95 transition-all touch-manipulation"
          >
            <ArrowDown className="w-6 h-6" />
            <span className="text-xs uppercase tracking-wide">Squat</span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => handlePress('right')}
            className="h-16 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 active:from-slate-700 active:to-slate-800 text-slate-100 font-extrabold flex flex-col items-center justify-center gap-1 shadow-md border border-slate-700 active:scale-95 transition-all touch-manipulation"
          >
            <ArrowRight className="w-6 h-6" />
            <span className="text-xs uppercase tracking-wide">Right</span>
          </button>
        </div>
      </div>
    </div>
  );
};
