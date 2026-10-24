# Architecture

## Overview

The phone performs camera inference locally. It sends only small semantic events to the local WebSocket relay. The desktop game consumes events and applies them to game state.

```text
Android Chrome
  Camera -> MediaPipe Pose Landmarker -> Calibration + Gesture Detector --\
  Orientation / Motion Sensor ---------------------------------------------+--> WebSocket
  Manual Test Buttons -----------------------------------------------------/       |
                                                                                   v
                                                                         Node.js WS Relay
                                                                                   |
                                                                                   v
Desktop Browser: React UI -> Game Input Adapter -> Game Engine -> Player / Obstacles
```

## Modules

### Controller UI
Owns camera permissions, preview, calibration controls, manual controls, status, and settings. It should not contain the core gesture algorithm.

### Pose pipeline
- Loads a pinned MediaPipe Tasks Vision version and a local model asset.
- Runs pose inference on video frames.
- Reads only the landmarks required for gesture recognition.
- Checks landmark visibility/confidence.
- Uses a throttled animation loop and cleans it up reliably.

### Gesture detector
Implement pure functions/classes independent of React and the camera:
- `calibrate(samples)`
- `detectJump(pose, calibration, previousState, now)`
- `detectSquat(...)`
- `detectLateralMovement(...)`
- `resetGestureState()`

Keep thresholds in a configuration object. Use hysteresis, cooldowns, and a re-arm condition.

### Sensor adapter
Use browser APIs when supported:
- `deviceorientation` for orientation angles, where available.
- `devicemotion` for acceleration and rotation-rate data.
- Request permission when the browser requires it.
- Normalize and clamp output. Do not treat rotation rate as orientation.
- Keep sensor controls optional; the game must work without them.

### Shared protocol
Contains event type definitions, payload validation, size limits, protocol version, and connection messages. The server must validate data at runtime; TypeScript types alone do not validate untrusted network input.

### WebSocket server
- Configurable host and port.
- Validates messages.
- Broadcasts accepted controller events to game clients.
- Handles client disconnects and stale connections.
- Optional pairing token and client roles.
- Does not accept or relay video frames.

### Game
- A game input adapter converts protocol events to game commands.
- A game engine owns the simulation loop, collision detection, and score.
- React owns surrounding UI and low-frequency status.
- Manual keyboard controls always remain available.

## Reliability rules

- Never fire repeated jump events for every frame during a single jump.
- Ignore gestures until calibration completes, except manual controls.
- Ignore pose samples when required landmarks have poor visibility.
- On disconnect, show a visible status and attempt bounded reconnect with backoff.
- Stop camera tracks and all listeners on stop/unmount.
- Prevent unhandled rejections from camera/model initialization.
