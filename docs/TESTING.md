# Testing Guide

## Automated checks

Run the commands provided by the root package scripts. Expected checks include:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

Do not report success unless each command has actually completed successfully.

## Unit tests

### Gesture detector
- Neutral standing pose does not trigger jump.
- Upward hip movement crossing the configured threshold triggers one jump.
- Continued airborne frames do not repeatedly trigger jump.
- Landing/re-arm allows a subsequent jump.
- Missing/low-visibility landmarks do not trigger a gesture.
- Squat requires the configured duration/threshold.
- Lateral movement respects threshold and hysteresis.
- Calibration handles too few or noisy samples safely.
- Cooldowns and event timestamps behave correctly.

### Protocol validation
- Valid gesture and sensor messages are accepted.
- Invalid JSON is rejected.
- Unknown event names and protocol versions are rejected.
- NaN, Infinity, out-of-range values, and oversized payloads are rejected.
- Invalid confidence values are rejected.

### WebSocket server
- Controller messages reach game clients.
- Messages are not broadcast to the originating controller unless explicitly designed.
- Invalid messages are not relayed.
- Disconnects do not crash the server.
- Pairing token is enforced when configured.

## Manual end-to-end test

1. Start server, game, and controller.
2. Confirm the game shows the controller as connected.
3. Press manual Jump on the phone; the player should jump once.
4. Disconnect Wi-Fi; the game should show disconnected state and keyboard controls should still work.
5. Reconnect; verify bounded reconnection and restored status.
6. Deny camera permission; manual mode must remain usable and an actionable error should appear.
7. Grant camera permission and confirm pose tracking starts.
8. Stand in a neutral pose and calibrate.
9. Jump once and confirm exactly one jump event.
10. Remain airborne briefly; no repeated jump should fire.
11. Land, wait for re-arm, then jump again.
12. Test squat, left/right movement, low light, partial body visibility, and moving out of frame.
13. Enable sensors if supported and verify tilt values are clamped.
14. Stop the controller; verify the camera indicator turns off.

## Android/browser checks

- Use current Android Chrome where possible.
- Test on the same Wi-Fi network as the PC.
- Camera and sensor APIs may require HTTPS or another secure context.
- Test with the phone in landscape and portrait orientations.
- Verify the whole body is visible, the phone is stable, and lighting is adequate.
