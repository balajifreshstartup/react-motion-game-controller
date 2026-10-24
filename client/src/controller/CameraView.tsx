import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { Camera, CameraOff, CheckCircle2, RefreshCw, Sparkles, UserCheck, AlertTriangle } from 'lucide-react';
import type { GestureType } from '@motion-game/protocol';
import { computeCalibration, extractPoseSummary, LANDMARK_INDEX } from './gestures/calibration.js';
import type { GestureConfig } from './gestures/config.js';
import { detectGestures, resetGestureState } from './gestures/detector.js';
import type {
  CalibrationData,
  GestureDetectorState,
  NormalizedLandmark,
  PoseSummary,
} from './gestures/types.js';

interface CameraViewProps {
  config: GestureConfig;
  onGestureDetected: (gesture: GestureType, confidence: number, source: 'camera') => void;
  calibration: CalibrationData;
  onCalibrationComplete: (cal: CalibrationData) => void;
  onResetCalibration: () => void;
}

type CameraState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'PERMISSION_DENIED'
  | 'LOADING_MODEL'
  | 'READY'
  | 'CALIBRATING'
  | 'TRACKING'
  | 'ERROR';

export const CameraView: React.FC<CameraViewProps> = ({
  config,
  onGestureDetected,
  calibration,
  onCalibrationComplete,
  onResetCalibration,
}) => {
  const [cameraState, setCameraState] = useState<CameraState>('IDLE');
  const [statusMessage, setStatusMessage] = useState<string>('Camera is stopped');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [poseConfidence, setPoseConfidence] = useState<number>(0);
  const [calibrationProgress, setCalibrationProgress] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const gestureStateRef = useRef<GestureDetectorState>(resetGestureState());
  const calibrationSamplesRef = useRef<PoseSummary[]>([]);
  const isCalibratingRef = useRef<boolean>(false);

  // Stop camera and cleanup streams
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraState('IDLE');
    setStatusMessage('Camera stopped');
    setPoseConfidence(0);
  }, []);

  // Initialize MediaPipe PoseLandmarker
  const initPoseLandmarker = async (): Promise<PoseLandmarker> => {
    if (landmarkerRef.current) return landmarkerRef.current;

    setStatusMessage('Loading Pose Landmark model...');
    setCameraState('LOADING_MODEL');

    // Pinned CDN for WASM binaries
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );

    // Try local model asset first, fall back to official Google storage model if needed
    try {
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/models/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      landmarkerRef.current = landmarker;
      return landmarker;
    } catch (localErr) {
      console.warn('[Camera] Local model load failed, trying official CDN fallback...', localErr);
      const fallbackLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
      });
      landmarkerRef.current = fallbackLandmarker;
      return fallbackLandmarker;
    }
  };

  // Start Camera and Inference loop
  const startCamera = async () => {
    try {
      setCameraState('REQUESTING_PERMISSION');
      setStatusMessage('Requesting camera permission...');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false, // strictly no microphone requested
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const landmarker = await initPoseLandmarker();

      setCameraState(calibration.isCalibrated ? 'TRACKING' : 'READY');
      setStatusMessage(calibration.isCalibrated ? 'Pose tracking active' : 'Please calibrate your neutral standing pose');

      // Start inference loop
      startInferenceLoop(landmarker);
    } catch (err: any) {
      console.error('[Camera] Start error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraState('PERMISSION_DENIED');
        setStatusMessage('Camera permission was denied. Tap browser settings to allow camera.');
      } else {
        setCameraState('ERROR');
        setStatusMessage(`Camera error: ${err.message || 'Unable to access camera'}`);
      }
    }
  };

  // Calibration Trigger
  const startCalibration = () => {
    calibrationSamplesRef.current = [];
    isCalibratingRef.current = true;
    setCameraState('CALIBRATING');
    setStatusMessage('Stand still in neutral pose: calibrating...');
    setCalibrationProgress(0);
  };

  // Main Detection Loop
  const startInferenceLoop = (landmarker: PoseLandmarker) => {
    let lastVideoTime = -1;

    const renderLoop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      // Check for new video frame
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const now = performance.now();

        try {
          const result: PoseLandmarkerResult = landmarker.detectForVideo(video, now);
          const landmarks = result.landmarks?.[0] as NormalizedLandmark[] | undefined;

          // Draw skeleton on canvas
          drawSkeleton(canvas, landmarks);

          if (landmarks && landmarks.length > 0) {
            const summary = extractPoseSummary(landmarks, Date.now(), config.minLandmarkConfidence);
            setPoseConfidence(summary.minConfidence);

            if (isCalibratingRef.current) {
              // Collecting calibration samples
              if (summary.isValid) {
                calibrationSamplesRef.current.push(summary);
                const progress = Math.min(100, Math.floor((calibrationSamplesRef.current.length / 30) * 100));
                setCalibrationProgress(progress);

                if (calibrationSamplesRef.current.length >= 30) {
                  isCalibratingRef.current = false;
                  const calRes = computeCalibration(calibrationSamplesRef.current, 15);
                  if (calRes.success) {
                    onCalibrationComplete(calRes.calibration);
                    setCameraState('TRACKING');
                    setStatusMessage('Calibration complete! Ready to play.');
                  } else {
                    setStatusMessage(`Calibration failed: ${calRes.reason}`);
                    setCameraState('READY');
                  }
                }
              }
            } else if (calibration.isCalibrated) {
              // Active gesture detection
              const detection = detectGestures(
                summary,
                calibration,
                gestureStateRef.current,
                config,
                Date.now()
              );

              if (detection.gesture) {
                onGestureDetected(detection.gesture, detection.confidence, 'camera');
              }
            }
          } else {
            setPoseConfidence(0);
          }
        } catch (inferErr) {
          console.warn('[Camera] Detection frame error:', inferErr);
        }
      }

      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameRef.current = requestAnimationFrame(renderLoop);
  };

  // Draw skeleton overlay
  const drawSkeleton = (canvas: HTMLCanvasElement, landmarks?: NormalizedLandmark[]) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!landmarks || landmarks.length === 0) return;

    const w = canvas.width;
    const h = canvas.height;

    // Bone connections
    const bones = [
      [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.RIGHT_SHOULDER],
      [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.LEFT_HIP],
      [LANDMARK_INDEX.RIGHT_SHOULDER, LANDMARK_INDEX.RIGHT_HIP],
      [LANDMARK_INDEX.LEFT_HIP, LANDMARK_INDEX.RIGHT_HIP],
      [LANDMARK_INDEX.LEFT_HIP, LANDMARK_INDEX.LEFT_KNEE],
      [LANDMARK_INDEX.RIGHT_HIP, LANDMARK_INDEX.RIGHT_KNEE],
      [LANDMARK_INDEX.LEFT_KNEE, LANDMARK_INDEX.LEFT_ANKLE],
      [LANDMARK_INDEX.RIGHT_KNEE, LANDMARK_INDEX.RIGHT_ANKLE],
    ];

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#22d3ee';
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 8;

    for (const [i1, i2] of bones) {
      const p1 = landmarks[i1];
      const p2 = landmarks[i2];
      if (p1 && p2 && (p1.visibility ?? 1) > 0.4 && (p2.visibility ?? 1) > 0.4) {
        // Mirror horizontally on user camera
        const x1 = (1 - p1.x) * w;
        const y1 = p1.y * h;
        const x2 = (1 - p2.x) * w;
        const y2 = p2.y * h;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    // Joints
    ctx.fillStyle = '#ffffff';
    for (const pt of landmarks) {
      if ((pt.visibility ?? 1) > 0.45) {
        const x = (1 - pt.x) * w;
        const y = pt.y * h;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
  };

  // Flip camera
  const toggleFacingMode = () => {
    stopCamera();
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, [stopCamera]);

  return (
    <div className="w-full flex flex-col items-center gap-3">
      {/* Video Preview Frame */}
      <div className="relative w-full max-w-sm aspect-[4/3] rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl flex items-center justify-center">
        {/* Mirror video for selfie view */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover -scale-x-100"
        />

        {/* Skeleton Canvas Overlay */}
        <canvas
          ref={canvasRef}
          width={400}
          height={300}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* State Overlays */}
        {cameraState === 'IDLE' && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center gap-3">
            <div className="p-4 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">Camera Tracking Off</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
                Place phone on a stable stand and grant camera permission to track body gestures.
              </p>
            </div>
            <button
              type="button"
              onClick={startCamera}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20"
            >
              Start Camera
            </button>
          </div>
        )}

        {(cameraState === 'REQUESTING_PERMISSION' || cameraState === 'LOADING_MODEL') && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center gap-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-xs font-semibold text-slate-200">{statusMessage}</p>
          </div>
        )}

        {cameraState === 'PERMISSION_DENIED' && (
          <div className="absolute inset-0 bg-rose-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center gap-3">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
            <div>
              <h3 className="font-bold text-rose-200 text-sm">Camera Permission Denied</h3>
              <p className="text-xs text-rose-300/80 mt-1">
                Please allow camera permissions in browser site settings, then tap Retry. Manual controls remain usable below.
              </p>
            </div>
            <button
              type="button"
              onClick={startCamera}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all"
            >
              Retry Camera
            </button>
          </div>
        )}

        {/* Calibration Progress Bar Overlay */}
        {cameraState === 'CALIBRATING' && (
          <div className="absolute inset-x-4 bottom-4 bg-slate-950/80 backdrop-blur-md p-3 rounded-2xl border border-cyan-500/30 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs font-bold text-cyan-300">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 animate-spin" /> Calibrating Neutral Pose...
              </span>
              <span>{calibrationProgress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-400 rounded-full transition-all duration-100"
                style={{ width: `${calibrationProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 text-center">Stand straight with your full body visible in frame</p>
          </div>
        )}

        {/* Top Badges inside preview */}
        {cameraState === 'TRACKING' && (
          <div className="absolute top-3 inset-x-3 flex justify-between items-center pointer-events-none">
            <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-700 text-[10px]">
              <span className={`w-2 h-2 rounded-full ${poseConfidence > 0.5 ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-slate-300 font-mono">{(poseConfidence * 100).toFixed(0)}% Pose Conf</span>
            </div>

            <div className="flex items-center gap-1 bg-emerald-500/20 backdrop-blur-md px-2.5 py-1 rounded-full border border-emerald-500/40 text-[10px] text-emerald-300 font-semibold">
              <UserCheck className="w-3 h-3" />
              <span>Calibrated</span>
            </div>
          </div>
        )}
      </div>

      {/* Camera Controls Bar */}
      {cameraState !== 'IDLE' && cameraState !== 'PERMISSION_DENIED' && (
        <div className="flex items-center justify-between w-full max-w-sm px-1">
          <button
            type="button"
            onClick={stopCamera}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all"
          >
            <CameraOff className="w-3.5 h-3.5" />
            <span>Stop Camera</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startCalibration}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-semibold border border-cyan-500/40 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Recalibrate</span>
            </button>

            <button
              type="button"
              onClick={toggleFacingMode}
              title="Switch Camera (Front/Back)"
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
