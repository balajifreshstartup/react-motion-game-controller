# Master Prompt: Build the Entire Motion Game Controller Project

You are a senior full-stack TypeScript engineer with experience in React, browser media APIs, MediaPipe, real-time WebSockets, game development, and Android mobile browsers.

Build a complete, runnable project called **Motion Game Controller**. The purpose is to let a user place an Android phone on a stable stand, stand in front of its camera, and control a game running in a desktop browser using real-life body movements. The phone camera recognizes body gestures; phone motion/orientation sensors provide optional tilt controls. Events travel over local Wi-Fi to a Node.js WebSocket server and then to a React game.

Do not return only a plan, mockup, or snippets. Create all source files, configuration, documentation, and tests needed for a working MVP. Work in small phases, run checks, fix errors, and report commands/results honestly. Never claim a command or test passed unless it was actually run.

## Product requirements

### A. Two user interfaces

1. **Desktop Game**
   - React + TypeScript + Vite.
   - A polished, responsive game screen with a simple 2D endless runner/platform game.
   - Use Phaser 3 if it improves maintainability; otherwise use Canvas with a clean game loop.
   - Show player, ground/platforms, obstacles, score, best score for the current session, pause/restart, and game-over state.
   - Keyboard fallback: Space/ArrowUp = jump, ArrowLeft = left, ArrowRight = right, ArrowDown = squat/slide.
   - Show controller connection state and last received gesture.
   - Never let React state updates run at the game-loop frame rate unnecessarily.

2. **Mobile Controller**
   - Mobile-first responsive page usable in Android Chrome.
   - Camera preview with start/stop controls and permission/error messages.
   - Use MediaPipe Tasks Vision Pose Landmarker for body landmarks.
   - Optional orientation/motion sensor controls with enable/disable controls.
   - Display pose confidence/visibility, calibration status, connection status, and a live event log.
   - Include large manual controls (Jump, Left, Right, Squat) to test connectivity when camera detection is unavailable.
   - Include a sensitivity setting and a recalibrate button.
   - Stop media tracks, animation loops, WebSocket connections, and event listeners on unmount/stop.

### B. Gestures

Implement real gesture detection with debouncing and calibration. Do not detect gestures from a single arbitrary frame.

- **Jump:** estimate hip/torso vertical position across frames; detect a rapid upward displacement relative to calibrated standing baseline, optionally supported by knee/ankle landmarks. Trigger once per jump. Require a return-to-baseline or landing condition before rearming.
- **Squat:** detect hip height decreasing relative to knees/torso and hold for a short configurable duration. Avoid repeated events while the user remains squatting.
- **Left/right:** detect body-center horizontal displacement or torso lean relative to the calibrated center. Use separate thresholds and hysteresis to avoid jitter.
- **Tilt:** read `deviceorientation` or `devicemotion` only when available and permission has been granted. Do not mislabel angular rotation rate as absolute tilt. Normalize and clamp values.
- Use landmark visibility/confidence thresholds and gracefully handle when the body is partially out of frame.
- Add a cooldown/refractory period per gesture and an event rate limit.
- Thresholds must be configurable in one clearly documented module.
- Include a calibration workflow: ask the user to stand still in a neutral pose, gather a short sample window, calculate baselines, then enable gestures.
- Provide a manual-only mode when camera permissions are denied or the device lacks required APIs.

### C. Communication

- Node.js server using `ws`.
- Listen on a configurable port, default 8080.
- A controller sends validated gesture/sensor messages. The server broadcasts them to connected game clients only.
- Implement a `/health` HTTP endpoint if practical.
- Use a shared protocol module with discriminated TypeScript unions and runtime validation.
- Add heartbeat/ping or stale-connection handling.
- Avoid accepting arbitrary messages, huge payloads, non-finite numbers, or unsupported gesture names.
- Send a connection acknowledgement and optionally role/pairing information.
- Allow one or more controller and game clients, but clearly document the behavior.
- Show useful logs without dumping sensitive camera content.
- Never send video frames to the server. Pose detection must run locally in the browser; only gesture events and optional normalized sensor values are transmitted.

### D. Security, privacy, and browser compatibility

- Camera processing should happen locally on the phone; do not upload/store video or body landmarks.
- Clearly request permissions and explain why each is needed.
- Do not request microphone access.
- Validate WebSocket origin/host and message schema; document LAN-only development assumptions.
- Provide optional shared pairing token for local sessions. Do not hard-code secrets.
- Use `wss://` for HTTPS deployments. Document that browser camera/sensor APIs generally require a secure context, with localhost as a common exception. A plain `http://<LAN-IP>` address may fail on Android Chrome.
- Avoid exposing the server publicly by default.
- Include a clear disconnect/stop button.
- Explain that the phone must be placed on a stable stand and the full body must be visible. Never ask users to hold or jump with the phone in their hand.
- Add graceful fallbacks for unsupported sensors, unavailable camera, low light, and model loading failures.

### E. Quality and UX

- Use clean, production-minded React components and hooks.
- Keep game, controller, networking, gesture detection, protocol, and shared config separated.
- Use strict TypeScript where applicable.
- Provide loading, empty, error, reconnecting, connected, and permission-denied states.
- Add an accessible UI: keyboard operation, visible focus, readable contrast, labels, and reduced-motion consideration.
- Avoid placeholder buttons that do nothing.
- Do not leave TODOs for core functionality.
- Do not add external paid services or require API keys.
- Pin compatible package versions; do not use `@latest` CDN URLs in production runtime configuration.
- Provide a clear model download step or script from an official source. Never invent a model URL. If automatic download is unreliable, document manual placement and verify the file exists before starting camera tracking.

## Suggested repository layout

Use npm workspaces only if it keeps setup reliable. A straightforward structure is preferred:

```text
motion-game/
  package.json
  tsconfig.json
  .env.example
  README.md
  docs/
    ARCHITECTURE.md
    API_PROTOCOL.md
    IMPLEMENTATION_PLAN.md
    TESTING.md
    SECURITY_AND_PRIVACY.md
  apps/
    game/
      package.json
      src/
        App.tsx
        components/
        game/
        hooks/
        styles/
    controller/
      package.json
      src/
        App.tsx
        components/
        hooks/
        motion/
        networking/
        styles/
  packages/
    protocol/
      package.json
      src/
  server/
    package.json
    src/
      index.ts
      validation.ts
      tests/
```

You may choose a single Vite app with `/game` and `/controller` routes if that makes the project more reliable. The final structure must be consistent with package scripts and README instructions.

## Required deliverables

1. Full source code for every required file.
2. Root `package.json` with clear scripts such as `dev`, `dev:server`, `build`, `typecheck`, `lint`, and `test`.
3. `.env.example` with safe example values only.
4. A README with exact Windows PowerShell and cross-platform setup instructions.
5. `docs/ARCHITECTURE.md` explaining components and data flow.
6. `docs/API_PROTOCOL.md` documenting every WebSocket message with examples.
7. `docs/IMPLEMENTATION_PLAN.md` showing milestones and acceptance criteria.
8. `docs/TESTING.md` with automated and manual testing steps.
9. `docs/SECURITY_AND_PRIVACY.md`.
10. Unit tests for gesture thresholds/debouncing, protocol validation, and server broadcast behavior.
11. A manual fallback so the game can be tested before camera tracking works.
12. A final summary of files created, commands executed, tests run, known limitations, and exact commands to start the project.

## Acceptance criteria

- `npm install` succeeds from the documented project root.
- `npm run dev` starts all required development processes, or README gives separate commands that work.
- Game and controller can connect through the WebSocket server using the configured URL.
- Pressing the controller's manual Jump button visibly makes the game character jump.
- Keyboard controls work when the phone is disconnected.
- When camera permission is granted and the model is present, the app shows pose landmarks/status and recognizes calibrated jump/squat/left/right gestures with debounce.
- If camera or sensors are unavailable, manual controls and clear error messages remain usable.
- Tilt events affect a defined game behavior, such as steering, and values are clamped.
- Tests cover malformed messages, unsupported event types, debounce, calibration edge cases, and reconnect/disconnect.
- No video frames are sent to the server.
- No secrets or API keys are committed.
- No core functionality is represented by a fake button or hardcoded “connected” state.

## Implementation workflow

1. Inspect the available environment and existing files before changing anything.
2. Create a short checklist, then implement the smallest working end-to-end vertical slice first: server, manual controller button, game event receiver, visible jump.
3. Add automated tests for the shared protocol and server.
4. Add MediaPipe camera setup and pose landmark visualization.
5. Implement calibration and gesture recognition as pure/testable functions.
6. Add motion/orientation sensors with feature detection and permission handling.
7. Integrate gesture events into the game.
8. Add error/reconnect handling and accessible UI.
9. Run install, lint, typecheck, tests, and production build. Fix failures rather than hiding them.
10. Verify README commands and report any checks that could not run.

Start implementing now. Make reasonable decisions without asking questions unless blocked by a truly essential unknown. Prefer a reliable, modest working MVP over an ambitious but broken architecture.
