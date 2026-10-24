import React from 'react';
import { Activity, Compass, ShieldAlert } from 'lucide-react';
import type { SensorEventMessage } from '@motion-game/protocol';

interface SensorsViewProps {
  isEnabled: boolean;
  isSupported: boolean;
  onToggle: () => void;
  lastSensorData: SensorEventMessage | null;
}

export const SensorsView: React.FC<SensorsViewProps> = ({
  isEnabled,
  isSupported,
  onToggle,
  lastSensorData,
}) => {
  const tiltX = lastSensorData?.tiltX ?? 0;
  const tiltY = lastSensorData?.tiltY ?? 0;

  return (
    <div className="w-full bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 border border-slate-800 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-slate-200">Orientation Sensors</span>
        </div>

        <button
          type="button"
          disabled={!isSupported}
          onClick={onToggle}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${
            isEnabled
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 hover:bg-cyan-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
          }`}
        >
          {isEnabled ? 'Enabled' : isSupported ? 'Enable Tilt' : 'Unsupported'}
        </button>
      </div>

      {!isSupported ? (
        <div className="text-xs text-slate-400 bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/40">
          DeviceOrientation API is not available on this browser or device. Camera gestures and manual controls remain fully functional.
        </div>
      ) : isEnabled ? (
        <div className="flex flex-col gap-2 pt-1">
          {/* Tilt X Visual Gauge */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span>Tilt X (Steering):</span>
              <span className={Math.abs(tiltX) > 0.1 ? 'text-cyan-300 font-bold' : 'text-slate-400'}>
                {tiltX.toFixed(2)}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full relative overflow-hidden">
              <div
                className="absolute top-0 bottom-0 bg-cyan-400 rounded-full transition-all duration-75"
                style={{
                  left: tiltX < 0 ? `${50 + tiltX * 50}%` : '50%',
                  width: `${Math.abs(tiltX) * 50}%`,
                }}
              />
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-600 -translate-x-1/2" />
            </div>
          </div>

          {/* Tilt Y Visual Gauge */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span>Tilt Y (Pitch):</span>
              <span className={Math.abs(tiltY) > 0.1 ? 'text-indigo-300 font-bold' : 'text-slate-400'}>
                {tiltY.toFixed(2)}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full relative overflow-hidden">
              <div
                className="absolute top-0 bottom-0 bg-indigo-400 rounded-full transition-all duration-75"
                style={{
                  left: tiltY < 0 ? `${50 + tiltY * 50}%` : '50%',
                  width: `${Math.abs(tiltY) * 50}%`,
                }}
              />
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-600 -translate-x-1/2" />
            </div>
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-400 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-slate-500" />
          <span>Tilt steering is currently off. Tap Enable Tilt to steer by leaning device.</span>
        </div>
      )}

      {/* Safety Notice */}
      <div className="flex items-start gap-2 text-[10px] text-amber-300/80 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
        <span>Keep phone in a secure stand while using camera tracking. Do not hold while jumping!</span>
      </div>
    </div>
  );
};
