# Motion Game Controller

A production-ready motion-control gaming system that uses an Android phone's camera and motion sensors to control a 2D desktop game over a local WebSocket relay server.

---

## Architecture Overview

```text
Android Chrome Phone
  Camera -> MediaPipe Pose Landmarker -> Calibration + Gesture Detector --\
  Orientation Sensors (Gyro/Accel) ----------------------------------------+--> WebSocket Client
  Manual Fallback Touch Pad ----------------------------------------------/            |
                                                                                       v
                                                                               Node.js WS Relay Server
                                                                                  (:8080 /health)
                                                                                       |
                                                                                       v
Desktop Browser: React UI -> Game Engine -> 2D Canvas Loop (Player, Obstacles, Parallax, HUD)
```

1. **Local Pose Inference**: Camera video is processed locally in the phone browser via MediaPipe Tasks Vision Pose Landmarker. **Zero video or camera frames are ever uploaded or transmitted.**
2. **WebSocket Relay**: A Node.js WebSocket relay (`server/`) validates messages at runtime using Zod (`@motion-game/protocol`) and broadcasts small JSON gesture and sensor events to game clients.
3. **2D Endless Runner Game**: Canvas-based runner ("Cyber Motion Dash") with player physics, jumping, sliding/squatting, 3-lane horizontal steering, obstacle generation, parallax cyber skyline, and keyboard fallback.
4. **Local Dual-Test Mode**: Run game and controller side-by-side on the same computer screen (`http://localhost:5173/#/dual`) for instant manual and webcam testing!

---

## Project Structure

```text
motionGame/
  package.json              # Root workspaces configuration and npm scripts
  tsconfig.json            # Root TypeScript project references
  vitest.config.ts          # Unified test configuration
  .env.example              # Example environment configuration
  .env                      # Local environment configuration
  docs/                     # Full project documentation
    ARCHITECTURE.md
    API_PROTOCOL.md
    IMPLEMENTATION_PLAN.md
    TESTING.md
    SECURITY_AND_PRIVACY.md
    README.md
  scripts/
    download-model.mjs      # Official MediaPipe model downloader
  packages/
    protocol/               # Shared TypeScript schemas, types, and Zod validators
      src/
        types.ts
        validation.ts
        index.ts
      tests/
        protocol.test.ts
  server/                   # Node.js WebSocket relay & /health endpoint
    src/
      server.ts
      config.ts
      index.ts
    tests/
      server.test.ts
  client/                   # React + TypeScript + Vite web application
    public/models/          # Local pose_landmarker_lite.task (5.5 MB)
    src/
      game/                 # GameEngine, GameCanvas, GameHUD, types
      controller/           # CameraView, ManualControls, SensorsView, EventLog
        gestures/           # Pure detector, neutral calibration, config
        sensors/            # SensorAdapter (DeviceOrientation normalized)
      networking/           # useWebSocket hook with exponential backoff
      components/           # Navbar, ConnectionModal
      App.tsx               # Client router: Game, Controller, Dual Mode
      main.tsx
      index.css             # Rich modern dark theme stylesheet
    tests/
      calibration.test.ts
      gestureDetector.test.ts
```

---

## Quick Start (Windows PowerShell & Cross-Platform)

### Prerequisites
- Node.js LTS (v18, v20, v22, or v26)
- npm (v9+)

### 1. Install Dependencies
```powershell
npm install
```

### 2. Download MediaPipe Model (Pre-packaged or Automated)
```powershell
npm run download:model
```
Downloads the official MediaPipe Pose Landmarker model (~5.5 MB) from Google Cloud Storage to `client/public/models/pose_landmarker_lite.task`.

### 3. Start Development Servers
Run both WebSocket server and Vite client concurrently:
```powershell
npm run dev
```

Or run in separate terminal windows:
```powershell
# Terminal 1: WebSocket Relay Server (Port 8080)
npm run dev:server

# Terminal 2: Vite Frontend Client (Port 5173)
npm run dev:client
```

Open the application:
- **Game Screen**: `http://localhost:5173/#/game`
- **Side-by-Side Dual Test**: `http://localhost:5173/#/dual`
- **Health Check**: `http://localhost:8080/health`

---

## Mobile Phone Setup (Android Chrome)

1. Connect your Android phone to the **same Wi-Fi network** as your computer.
2. Note your computer's local IP address (e.g. `192.168.1.5` displayed in the Vite terminal).
3. On your Android phone, open Chrome and navigate to:
   ```text
   http://<YOUR-COMPUTER-LAN-IP>:5173/#/controller
   ```
4. **Camera Access Over LAN Note**:
   Modern mobile browsers restrict camera access to secure contexts (`https://` or `localhost`).
   If accessing via plain HTTP over LAN IP, enable the origin in Chrome on Android:
   - Navigate to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
   - Add your computer's URL: `http://<YOUR-COMPUTER-LAN-IP>:5173`
   - Set dropdown to **Enabled** and relaunch Chrome.
5. Place the phone securely on a stand facing you.
6. Tap **Start Camera**, then tap **Recalibrate** and stand straight for 2 seconds to set neutral posture baselines.

---

## Controls Reference

### Game Controls
| Action | Keyboard | Phone Gesture | Manual Button |
|---|---|---|---|
| **Jump** | `Space` or `ArrowUp` | Physical Jump (upward hip leap) | `Jump` (Cyan) |
| **Squat / Slide** | `ArrowDown` | Physical Squat (hip drop & hold) | `Squat` (Indigo) |
| **Steer Left** | `ArrowLeft` | Step/Lean Left | `Left` |
| **Steer Right** | `ArrowRight` | Step/Lean Right | `Right` |
| **Tilt Steer** | N/A | Tilt phone left/right (Gyro) | N/A |
| **Pause / Resume** | `P` | N/A | Pause Button |
| **Restart** | `Enter` or `Space` | Physical Jump | Tap Screen / Space |

---

## Available Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Runs both WebSocket server and Vite client concurrently |
| `npm run dev:server` | Starts WebSocket relay server with watch mode (`tsx`) |
| `npm run dev:client` | Starts Vite client dev server on host `0.0.0.0:5173` |
| `npm run build` | Compiles protocol, server (`tsc`), and client (`vite build`) |
| `npm run typecheck` | Runs `tsc --noEmit` across all workspaces |
| `npm run lint` | Runs code checks across all workspaces |
| `npm test` | Runs 31 unit & integration tests with Vitest |
| `npm run download:model` | Downloads official MediaPipe pose model |

---

## Testing Results

The test suite consists of 31 automated unit and integration tests across 4 test suites:
- **`packages/protocol/tests/protocol.test.ts`** (13 tests):
  - Valid hello, gesture, and sensor events
  - Payloads exceeding 4KB rejected
  - Invalid JSON and unknown event names rejected
  - Out-of-bounds confidence (<0 or >1) and tilt (< -1 or > 1) rejected
  - Non-finite numbers (NaN, Infinity) rejected
  - Server connected, error, and peer status schemas validated
- **`server/tests/server.test.ts`** (6 tests):
  - `/health` HTTP endpoint returns 200 with server status & client counts
  - Client hello registration & connection acknowledgement
  - Relays gestures to game clients without echo to sender
  - Invalid messages rejected with error without crashing server
  - Clean client disconnect and peer count updates
  - Pairing token enforcement when configured
- **`client/tests/calibration.test.ts`** (5 tests):
  - Landmark extraction & confidence scoring
  - Rejection of low-confidence or missing landmark frames
  - Rejection when sample count is insufficient
  - Stability check rejecting high variance / jittery standing
  - Baseline computation (hip, torso, knee heights)
- **`client/tests/gestureDetector.test.ts`** (7 tests):
  - Neutral standing pose produces no gestures
  - Rapid upward hip displacement triggers single Jump event
  - Airborne frames do not repeatedly trigger jump
  - Landing and cooldown re-arm jump state
  - Low confidence frames ignored
  - Squat duration hold and no-repeat logic
  - Lateral movement with hysteresis band
