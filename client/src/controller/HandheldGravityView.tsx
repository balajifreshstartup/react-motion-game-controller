import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Compass,
  Gauge,
  HelpCircle,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Sparkles,
  Vibrate,
  Zap,
} from 'lucide-react';
import type { GestureType } from '@motion-game/protocol';
import type { SensorAdapter, SensorSensitivity, SensorTelemetry } from './sensors/sensorAdapter.js';

interface HandheldGravityViewProps {
  adapter: SensorAdapter | null;
  isEnabled: boolean;
  onToggleEnabled: () => void;
  onManualGesture: (gesture: GestureType) => void;
}

export const HandheldGravityView: React.FC<HandheldGravityViewProps> = ({
  adapter,
  isEnabled,
  onToggleEnabled,
  onManualGesture,
}) => {
  const [telemetry, setTelemetry] = useState<SensorTelemetry>({
    tiltX: 0,
    tiltY: 0,
    gamma: 0,
    beta: 42,
    accelX: 0,
    accelY: 0,
    accelZ: 0,
    lastGesture: null,
    lastGestureTime: 0,
    eventsCount: 0,
    isCalibrated: false,
  });

  const [sensitivity, setSensitivity] = useState<SensorSensitivity>('medium');
  const [enableFlicks, setEnableFlicks] = useState<boolean>(true);
  const [calibratedSuccess, setCalibratedSuccess] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);

  const isSecure = typeof window !== 'undefined' && window.isSecureContext === true;
  const isSupported = adapter ? adapter.isSupported() : false;

  // Sync telemetry updates
  useEffect(() => {
    if (!adapter) return;

    const interval = setInterval(() => {
      setTelemetry(adapter.getTelemetry());
    }, 40); // 25 fps UI refresh

    return () => clearInterval(interval);
  }, [adapter]);

  const handleSensitivityChange = (newLevel: SensorSensitivity) => {
    setSensitivity(newLevel);
    adapter?.setSensitivity(newLevel);
  };

  const handleFlickToggle = () => {
    const next = !enableFlicks;
    setEnableFlicks(next);
    adapter?.setEnableFlicks(next);
  };

  const handleCalibrate = () => {
    if (!adapter) return;
    adapter.calibrateNeutral();
    setCalibratedSuccess(true);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([30, 40, 30]);
      } catch {
        // Ignore haptics errors
      }
    }
    setTimeout(() => setCalibratedSuccess(false), 1600);
  };

  const handleResetCalibration = () => {
    adapter?.resetCalibration();
  };

  const tiltX = telemetry.tiltX;
  const tiltY = telemetry.tiltY;
  const isJumpActive =
    telemetry.lastGesture === 'jump' && Date.now() - telemetry.lastGestureTime < 450;
  const isSlideActive =
    telemetry.lastGesture === 'squat' && Date.now() - telemetry.lastGestureTime < 450;
  const isLeftActive =
    telemetry.lastGesture === 'left' && Date.now() - telemetry.lastGestureTime < 350;
  const isRightActive =
    telemetry.lastGesture === 'right' && Date.now() - telemetry.lastGestureTime < 350;

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Insecure Context Warning for Android Chrome */}
      {!isSecure && (
        <div className="w-full bg-amber-500/15 border border-amber-500/30 rounded-2xl p-3 text-xs text-amber-200 flex flex-col gap-1.5 shadow-lg">
          <div className="flex items-center justify-between font-bold text-amber-300">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Insecure Connection Warning (HTTP)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="text-[11px] underline text-amber-300 hover:text-white"
            >
              {showHelp ? 'Hide Fix' : 'How to fix'}
            </button>
          </div>
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            Android Chrome blocks phone motion & gravity sensors on plain <code>http://</code>. For full motion support, use <strong>HTTPS</strong> or enable the Chrome flag.
          </p>
          {showHelp && (
            <div className="mt-1 pt-2 border-t border-amber-500/20 text-[10px] space-y-1 font-mono text-amber-100 bg-amber-950/40 p-2 rounded-lg">
              <p><strong>Option 1 (Easiest):</strong> Access via <code>https://&lt;your-ip&gt;:5173</code> (accept self-signed SSL certificate).</p>
              <p><strong>Option 2:</strong> In Chrome, open <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> and add your computer's IP.</p>
            </div>
          )}
        </div>
      )}

      {/* Main Sensor Cockpit Card */}
      <div className="w-full bg-slate-900/80 backdrop-blur-md rounded-3xl p-4 border border-slate-800 shadow-2xl flex flex-col gap-4">
        {/* Header Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-inner">
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                Gravity Motion Controller
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-normal">
                  v2.0
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Tilt to steer, flick to jump & slide</p>
            </div>
          </div>

          <button
            type="button"
            disabled={!isSupported}
            onClick={onToggleEnabled}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
              isEnabled
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-cyan-500/20 font-black'
                : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-750'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            {isEnabled ? 'ACTIVE' : 'START SENSOR'}
          </button>
        </div>

        {/* 3D Artificial Horizon / Gyroscope Radar */}
        <div className="relative w-full h-44 bg-slate-950 rounded-2xl border border-slate-800/80 overflow-hidden flex items-center justify-center shadow-inner">
          {/* Background Grid Lines */}
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Crosshairs & Pitch Ladder */}
          <div className="absolute inset-x-8 top-1/2 h-[1px] bg-cyan-500/30 -translate-y-1/2" />
          <div className="absolute inset-y-6 left-1/2 w-[1px] bg-cyan-500/30 -translate-x-1/2" />
          <div className="absolute w-24 h-24 rounded-full border border-cyan-500/20 pointer-events-none" />
          <div className="absolute w-36 h-36 rounded-full border border-cyan-500/10 pointer-events-none" />

          {/* Animated Artificial Horizon Line */}
          <div
            className="absolute w-48 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent transition-transform duration-75"
            style={{
              transform: `translateY(${tiltY * 38}px) rotate(${tiltX * 28}deg)`,
            }}
          />

          {/* Floating Gravity Bubble Reticle */}
          <div
            className="absolute w-10 h-10 rounded-full border-2 border-cyan-400 bg-cyan-400/20 backdrop-blur-sm shadow-[0_0_15px_rgba(56,189,248,0.5)] flex items-center justify-center transition-all duration-75 pointer-events-none"
            style={{
              transform: `translate(${tiltX * 65}px, ${tiltY * 45}px)`,
            }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-300 shadow-sm" />
          </div>

          {/* Real-time Motion Feedback Overlays */}
          <div className="absolute top-2 left-3 text-[10px] font-mono text-slate-400 flex flex-col gap-0.5">
            <span>ROLL: {telemetry.gamma.toFixed(1)}°</span>
            <span>PITCH: {telemetry.beta.toFixed(1)}°</span>
          </div>

          <div className="absolute top-2 right-3 text-[10px] font-mono text-slate-400 flex flex-col items-end gap-0.5">
            <span className={Math.abs(tiltX) > 0.1 ? 'text-cyan-300 font-bold' : ''}>
              STEER: {(tiltX * 100).toFixed(0)}%
            </span>
            <span>EVENTS: {telemetry.eventsCount}</span>
          </div>

          {/* Gesture Flash Indicators inside Horizon */}
          {isJumpActive && (
            <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-[2px] flex items-center justify-center animate-pulse">
              <span className="text-xl font-black text-emerald-300 tracking-wider flex items-center gap-2 drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]">
                <ArrowUp className="w-6 h-6 stroke-[3]" /> JUMP DETECTED!
              </span>
            </div>
          )}
          {isSlideActive && (
            <div className="absolute inset-0 bg-indigo-500/25 backdrop-blur-[2px] flex items-center justify-center animate-pulse">
              <span className="text-xl font-black text-indigo-300 tracking-wider flex items-center gap-2 drop-shadow-[0_0_12px_rgba(99,102,241,0.8)]">
                <ArrowDown className="w-6 h-6 stroke-[3]" /> SLIDE DETECTED!
              </span>
            </div>
          )}
        </div>

        {/* Live Steering Gauge Bar */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              Tilt Steering
            </span>
            <span className="font-mono text-[11px] text-cyan-300 font-bold">
              {tiltX < -0.1 ? '◀ LEFT' : tiltX > 0.1 ? 'RIGHT ▶' : 'CENTER'}
            </span>
          </div>
          <div className="w-full h-3 bg-slate-950 rounded-full relative overflow-hidden border border-slate-800">
            <div
              className="absolute top-0 bottom-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-75"
              style={{
                left: tiltX < 0 ? `${50 + tiltX * 50}%` : '50%',
                width: `${Math.abs(tiltX) * 50}%`,
              }}
            />
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-500 -translate-x-1/2" />
          </div>
        </div>

        {/* Calibration & Sensitivity Bar */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
          {/* Calibrate Neutral Button */}
          <button
            type="button"
            onClick={handleCalibrate}
            className={`w-full py-2.5 px-3 rounded-2xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
              calibratedSuccess
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : 'bg-slate-800/90 hover:bg-slate-750 text-slate-200 border-slate-700'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>{calibratedSuccess ? 'Calibrated!' : 'Set Neutral Angle'}</span>
          </button>

          {/* Sensitivity Picker */}
          <div className="flex items-center justify-between bg-slate-800/60 p-1 rounded-2xl border border-slate-700/80 text-[11px]">
            <span className="text-slate-400 pl-2 font-medium">Sens:</span>
            <div className="flex gap-1">
              {(['low', 'medium', 'high'] as SensorSensitivity[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleSensitivityChange(level)}
                  className={`px-2 py-1 rounded-xl uppercase font-bold transition-all ${
                    sensitivity === level
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {level[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Ergonomic Handheld Action Touchpad (Hybrid Mode) */}
      <div className="w-full bg-slate-900/60 backdrop-blur-md rounded-3xl p-3 border border-slate-800 flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Hybrid Action Buttons</span>
          </div>
          <span className="text-[10px] text-slate-400">Flick or tap buttons to play</span>
        </div>

        {/* Big Dual Thumb Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          {/* SLIDE / SQUAT Button */}
          <button
            type="button"
            onClick={() => onManualGesture('squat')}
            className={`h-24 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1.5 shadow-lg active:scale-95 ${
              isSlideActive
                ? 'bg-indigo-600/40 border-indigo-400 text-white'
                : 'bg-indigo-950/30 border-indigo-500/30 text-indigo-200 hover:bg-indigo-900/40 active:bg-indigo-800/50'
            }`}
          >
            <div className="p-2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <ArrowDown className="w-6 h-6 stroke-[3]" />
            </div>
            <span className="text-sm font-black tracking-wide">SLIDE</span>
            <span className="text-[10px] text-indigo-300/70 uppercase">Flick down or tap</span>
          </button>

          {/* JUMP Button */}
          <button
            type="button"
            onClick={() => onManualGesture('jump')}
            className={`h-24 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1.5 shadow-lg active:scale-95 ${
              isJumpActive
                ? 'bg-cyan-600/40 border-cyan-400 text-white'
                : 'bg-cyan-950/30 border-cyan-500/30 text-cyan-200 hover:bg-cyan-900/40 active:bg-cyan-800/50'
            }`}
          >
            <div className="p-2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              <ArrowUp className="w-6 h-6 stroke-[3]" />
            </div>
            <span className="text-sm font-black tracking-wide">JUMP</span>
            <span className="text-[10px] text-cyan-300/70 uppercase">Flick up or tap</span>
          </button>
        </div>

        {/* Quick Lane Nudges */}
        <div className="grid grid-cols-2 gap-2 mt-0.5">
          <button
            type="button"
            onClick={() => onManualGesture('left')}
            className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
              isLeftActive
                ? 'bg-cyan-500/30 border-cyan-400 text-white'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
            <span>Shift Left Lane</span>
          </button>

          <button
            type="button"
            onClick={() => onManualGesture('right')}
            className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
              isRightActive
                ? 'bg-cyan-500/30 border-cyan-400 text-white'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>Shift Right Lane</span>
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
