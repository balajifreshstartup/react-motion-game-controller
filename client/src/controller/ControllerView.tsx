import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Camera,
  CheckCircle2,
  Compass,
  Gamepad2,
  Radio,
  Sliders,
  Smartphone,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { ClientMessage, GestureType, SensorEventMessage } from '@motion-game/protocol';
import { useWebSocket } from '../networking/useWebSocket.js';
import { CameraView } from './CameraView.js';
import { EventLog } from './EventLog.js';
import { DEFAULT_GESTURE_CONFIG, getScaledConfig, type SensitivityLevel } from './gestures/config.js';
import type { CalibrationData } from './gestures/types.js';
import { HandheldGravityView } from './HandheldGravityView.js';
import { ManualControls } from './ManualControls.js';
import { SensorAdapter } from './sensors/sensorAdapter.js';
import { SensorsView } from './SensorsView.js';

interface ControllerViewProps {
  wsUrl?: string;
  pairingToken?: string;
}

export type ControllerTab = 'gravity' | 'camera' | 'manual';

export const ControllerView: React.FC<ControllerViewProps> = ({ wsUrl, pairingToken }) => {
  const [activeTab, setActiveTab] = useState<ControllerTab>('gravity');
  const [sensitivity, setSensitivity] = useState<SensitivityLevel>('medium');
  const [calibration, setCalibration] = useState<CalibrationData>({
    isCalibrated: false,
    baselineHipY: 0,
    baselineTorsoCenterY: 0,
    baselineCenterX: 0,
    baselineTorsoHeight: 0,
    baselineKneeY: 0,
    sampleCount: 0,
    calibratedAt: 0,
  });

  const [sensorEnabled, setSensorEnabled] = useState<boolean>(false);
  const [lastSensorData, setLastSensorData] = useState<SensorEventMessage | null>(null);
  const [eventsLog, setEventsLog] = useState<{ id: string; timestamp: number; message: ClientMessage }[]>([]);

  // WebSocket hook connecting as 'controller'
  const { status, errorMessage, gamesCount, sendMessage } = useWebSocket({
    url: wsUrl,
    role: 'controller',
    pairingToken,
  });

  // Calculate scaled config based on sensitivity
  const activeConfig = useMemo(() => {
    return getScaledConfig(DEFAULT_GESTURE_CONFIG, sensitivity);
  }, [sensitivity]);

  const addEventToLog = useCallback((message: ClientMessage) => {
    setEventsLog((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        message,
      },
      ...prev.slice(0, 15),
    ]);
  }, []);

  // Handler for camera detected gestures
  const handleCameraGesture = useCallback(
    (gesture: GestureType, confidence: number) => {
      const msg: ClientMessage = {
        version: 1,
        timestamp: Date.now(),
        type: 'gesture',
        gesture,
        confidence,
        source: 'camera',
      };
      sendMessage(msg);
      addEventToLog(msg);
    },
    [sendMessage, addEventToLog]
  );

  // Handler for manual tactile buttons
  const handleManualGesture = useCallback(
    (gesture: GestureType) => {
      const msg: ClientMessage = {
        version: 1,
        timestamp: Date.now(),
        type: 'gesture',
        gesture,
        confidence: 1.0,
        source: 'manual',
      };
      sendMessage(msg);
      addEventToLog(msg);
    },
    [sendMessage, addEventToLog]
  );

  // Sensor Adapter initialization
  const sensorAdapterRef = useRef<SensorAdapter | null>(null);
  const [adapterInstance, setAdapterInstance] = useState<SensorAdapter | null>(null);
  const [sensorSupported, setSensorSupported] = useState<boolean>(false);

  useEffect(() => {
    const adapter = new SensorAdapter({
      onSensorData: (sensorMsg) => {
        setLastSensorData(sensorMsg);
        sendMessage(sensorMsg);
      },
      onGesture: (gesture, confidence) => {
        const msg: ClientMessage = {
          version: 1,
          timestamp: Date.now(),
          type: 'gesture',
          gesture,
          confidence,
          source: 'sensor',
        };
        sendMessage(msg);
        addEventToLog(msg);
      },
    });

    sensorAdapterRef.current = adapter;
    setAdapterInstance(adapter);
    setSensorSupported(adapter.isSupported());

    // Auto-start sensor on mobile if permission doesn't block it
    if (adapter.isSupported()) {
      adapter.requestPermission().then((granted) => {
        if (granted && adapter.start()) {
          setSensorEnabled(true);
        }
      });
    }

    return () => {
      adapter.stop();
      sensorAdapterRef.current = null;
      setAdapterInstance(null);
    };
  }, [sendMessage, addEventToLog]);

  const handleToggleSensor = async () => {
    const adapter = sensorAdapterRef.current;
    if (!adapter) return;

    if (sensorEnabled) {
      adapter.stop();
      setSensorEnabled(false);
    } else {
      const granted = await adapter.requestPermission();
      if (granted && adapter.start()) {
        setSensorEnabled(true);
      }
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center px-4 py-4 max-w-md mx-auto">
      {/* Top Header & Connection Pill */}
      <header className="w-full flex items-center justify-between py-2 border-b border-slate-800/80 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white">Motion Controller</h1>
            <p className="text-[10px] text-slate-400">Android Phone Client</p>
          </div>
        </div>

        {/* Connection status badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
            status === 'CONNECTED'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : status === 'CONNECTING' || status === 'RECONNECTING'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
          }`}
        >
          {status === 'CONNECTED' ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
          <span>{status === 'CONNECTED' ? `${gamesCount} Game Connected` : status}</span>
        </div>
      </header>

      {/* Error banner if present */}
      {errorMessage && (
        <div className="w-full mb-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 px-3 py-2 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Controller Mode Switcher Tab Bar */}
      <div className="w-full grid grid-cols-3 gap-1 bg-slate-900/80 p-1 rounded-2xl border border-slate-800 mb-3 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('gravity')}
          className={`py-2 px-1 rounded-xl font-bold flex flex-col items-center gap-1 transition-all ${
            activeTab === 'gravity'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-black'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span className="text-[11px]">Gravity Phone</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('camera')}
          className={`py-2 px-1 rounded-xl font-bold flex flex-col items-center gap-1 transition-all ${
            activeTab === 'camera'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-black'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span className="text-[11px]">Camera Pose</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          className={`py-2 px-1 rounded-xl font-bold flex flex-col items-center gap-1 transition-all ${
            activeTab === 'manual'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-black'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Gamepad2 className="w-4 h-4" />
          <span className="text-[11px]">Touch Pad</span>
        </button>
      </div>

      {/* TAB 1: Handheld Gravity Mode (Primary & Default) */}
      {activeTab === 'gravity' && (
        <HandheldGravityView
          adapter={adapterInstance}
          isEnabled={sensorEnabled}
          onToggleEnabled={handleToggleSensor}
          onManualGesture={handleManualGesture}
        />
      )}

      {/* TAB 2: Camera Body Tracking Mode */}
      {activeTab === 'camera' && (
        <div className="w-full flex flex-col gap-3">
          {/* Sensitivity Picker */}
          <div className="w-full flex items-center justify-between bg-slate-900/60 backdrop-blur-md p-2.5 rounded-2xl border border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Sensitivity:</span>
            </div>
            <div className="flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-slate-700">
              {(['low', 'medium', 'high'] as SensitivityLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSensitivity(level)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase transition-all ${
                    sensitivity === level
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <CameraView
            config={activeConfig}
            calibration={calibration}
            onGestureDetected={handleCameraGesture}
            onCalibrationComplete={(newCal) => setCalibration(newCal)}
            onResetCalibration={() =>
              setCalibration({
                isCalibrated: false,
                baselineHipY: 0,
                baselineTorsoCenterY: 0,
                baselineCenterX: 0,
                baselineTorsoHeight: 0,
                baselineKneeY: 0,
                sampleCount: 0,
                calibratedAt: 0,
              })
            }
          />
        </div>
      )}

      {/* TAB 3: Pure Manual Touch Pad */}
      {activeTab === 'manual' && (
        <div className="w-full my-2">
          <ManualControls onTriggerGesture={handleManualGesture} />
        </div>
      )}

      {/* Event Transmission Log (collapsible) */}
      <div className="w-full my-3">
        <EventLog events={eventsLog} onClear={() => setEventsLog([])} />
      </div>
    </div>
  );
};
