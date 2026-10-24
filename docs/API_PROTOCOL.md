# WebSocket API Protocol

## Transport

- Development default: `ws://<computer-LAN-IP>:8080`
- Production: `wss://<host>/ws`
- Keep the server on a trusted local network during development.
- Only small JSON messages are allowed. Never send video or image frames.

## Common envelope

Every client message should include a protocol version and timestamp.

```json
{
  "version": 1,
  "timestamp": 1730000000000,
  "type": "gesture",
  "gesture": "jump"
}
```

Use milliseconds since Unix epoch for timestamps. Reject invalid JSON, unsupported versions, unknown event names, oversized messages, and non-finite numeric values.

## Client messages

### Gesture event

```json
{
  "version": 1,
  "timestamp": 1730000000000,
  "type": "gesture",
  "gesture": "jump",
  "confidence": 0.91,
  "source": "camera"
}
```

Allowed `gesture` values: `jump`, `squat`, `left`, `right`, `neutral`.

Allowed `source` values: `camera`, `manual`, `sensor`.

`confidence` is optional and must be between 0 and 1.

### Sensor event

```json
{
  "version": 1,
  "timestamp": 1730000000000,
  "type": "sensor",
  "tiltX": -0.25,
  "tiltY": 0.42
}
```

`tiltX` and `tiltY` must be finite normalized numbers from -1 to 1.

### Client hello

```json
{
  "version": 1,
  "type": "hello",
  "role": "controller",
  "pairingToken": "optional-configured-token"
}
```

Roles: `controller` and `game`. Pairing token is optional in local development and should be enabled/configured for deployments.

## Server messages

### Connected

```json
{
  "version": 1,
  "type": "connected",
  "clientId": "server-generated-id"
}
```

### Error

```json
{
  "version": 1,
  "type": "error",
  "code": "INVALID_MESSAGE",
  "message": "The message was not accepted."
}
```

Do not expose stack traces, secrets, or internal paths to clients.

## Relay behavior

- Accept only validated messages.
- Broadcast gesture/sensor events to connected game-role clients.
- Do not blindly rebroadcast hello or error messages.
- Add a payload-size limit and rate limit.
- Log connection/disconnection and aggregate error counts without logging camera data.
