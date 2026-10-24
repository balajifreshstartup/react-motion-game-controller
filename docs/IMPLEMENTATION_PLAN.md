# Implementation Plan

## Milestone 1: End-to-end manual control

- [ ] Create project structure and package scripts.
- [ ] Start WebSocket server.
- [ ] Connect game client.
- [ ] Connect controller client.
- [ ] Manual Jump button triggers a visible player jump.
- [ ] Keyboard controls work without a phone.
- [ ] Add connection and error status.

**Acceptance:** A manual controller event reliably moves the character in the desktop game.

## Milestone 2: Game loop

- [ ] Implement player movement and gravity.
- [ ] Add ground/platforms and obstacles.
- [ ] Add collision detection and game-over/restart.
- [ ] Add score and pause.
- [ ] Keep game simulation separate from React rendering.

**Acceptance:** The game is playable using keyboard and manual controller buttons.

## Milestone 3: Camera pose tracking

- [ ] Add camera permission flow.
- [ ] Load a pinned MediaPipe Tasks Vision version.
- [ ] Verify model asset exists and show loading errors.
- [ ] Render or report pose landmarks.
- [ ] Handle no-person and low-visibility states.
- [ ] Stop tracks and inference loops on exit.

**Acceptance:** A user can see that their body is being tracked locally in the browser.

## Milestone 4: Gesture detection

- [ ] Add neutral-pose calibration.
- [ ] Implement jump detection using temporal hip/torso displacement.
- [ ] Add landing/re-arm logic and cooldown.
- [ ] Implement squat detection.
- [ ] Implement left/right displacement or lean.
- [ ] Add confidence thresholds and hysteresis.
- [ ] Unit test detector logic.

**Acceptance:** A single physical jump causes one jump event, not a stream of repeated events.

## Milestone 5: Motion sensors

- [ ] Detect supported orientation/motion APIs.
- [ ] Request permission where required.
- [ ] Add sensor enable/disable controls.
- [ ] Normalize and clamp sensor values.
- [ ] Map tilt to game steering.
- [ ] Show unsupported/permission-denied states.

**Acceptance:** Tilt controls work on supported devices and do not block camera/manual controls when unavailable.

## Milestone 6: Robustness and documentation

- [ ] Add runtime protocol validation and payload size limits.
- [ ] Add reconnect logic and stale-connection handling.
- [ ] Add pairing token configuration.
- [ ] Test HTTPS/secure-context requirements on Android.
- [ ] Run lint, typecheck, tests, and production build.
- [ ] Verify all README commands on Windows PowerShell.
- [ ] Document limitations and troubleshooting.

**Acceptance:** Fresh setup follows the README and reaches a working playable MVP.
