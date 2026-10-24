# Security and Privacy

## Privacy defaults

- Process camera frames locally in the controller browser.
- Never transmit or persist raw video frames.
- Do not request microphone access.
- Transmit only gesture events and normalized sensor data needed by the game.
- Do not save pose landmarks unless a future feature explicitly requires it and the user consents.
- Stop camera tracks when the user stops tracking or leaves the page.

## Network safety

- Bind to localhost by default where feasible; document how to opt into LAN access.
- Do not expose the WebSocket server directly to the public internet by default.
- Validate message schema, payload size, allowed event types, numeric ranges, and protocol version.
- Configure allowed origins and use `wss://` for hosted deployments.
- Support a pairing token for trusted local sessions; load secrets from environment variables and never commit real tokens.
- Apply basic rate limiting and disconnect clients sending abusive traffic.
- Avoid logging secrets, raw sensor streams, or sensitive data.

## Physical safety

- Put the phone on a stable stand with the full body visible.
- Do not hold the phone while jumping.
- Keep enough clear floor space to avoid hitting furniture or other people.
- Provide a stop control and do not require rapid or high-impact movements.
