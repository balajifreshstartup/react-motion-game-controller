import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { PROTOCOL_VERSION, type ClientHelloMessage, type GestureEventMessage } from '@motion-game/protocol';
import { MotionRelayServer } from '../src/server.js';

describe('MotionRelayServer Integration Tests', () => {
  let server: MotionRelayServer;
  let serverPort: number;

  beforeEach(async () => {
    // Start on port 0 to get an ephemeral OS-assigned free port
    server = new MotionRelayServer({
      port: 0,
      host: '127.0.0.1',
      pairingToken: null,
      pingIntervalMs: 5000,
      rateLimitPerSecond: 100,
    });
    const addr = await server.start();
    serverPort = addr.port;
  });

  afterEach(async () => {
    await server.close();
  });

  function createClient(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}`);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
    });
  }

  function waitForMessage(ws: WebSocket): Promise<any> {
    return new Promise((resolve) => {
      ws.once('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });
  }

  it('provides a working /health HTTP endpoint', async () => {
    const res = await fetch(`http://127.0.0.1:${serverPort}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBe(PROTOCOL_VERSION);
    expect(body.clients.total).toBe(0);
  });

  it('allows clients to send hello and receives connected message', async () => {
    const ws = await createClient();
    const hello: ClientHelloMessage = {
      version: 1,
      type: 'hello',
      role: 'game',
    };
    ws.send(JSON.stringify(hello));

    const response = await waitForMessage(ws);
    expect(response.type).toBe('connected');
    expect(response.role).toBe('game');
    expect(response.clientId).toBeDefined();

    ws.close();
  });

  it('relays controller gestures to game client, but not back to controller', async () => {
    const gameWs = await createClient();
    const controllerWs = await createClient();

    // Register game
    gameWs.send(JSON.stringify({ version: 1, type: 'hello', role: 'game' }));
    await waitForMessage(gameWs); // 'connected'

    // Register controller
    controllerWs.send(JSON.stringify({ version: 1, type: 'hello', role: 'controller' }));
    await waitForMessage(controllerWs); // 'connected'

    // Listen for next gesture message on game
    const gameGesturePromise = new Promise<any>((resolve) => {
      const handler = (raw: any) => {
        const parsed = JSON.parse(raw.toString());
        if (parsed.type === 'gesture') {
          gameWs.off('message', handler);
          resolve(parsed);
        }
      };
      gameWs.on('message', handler);
    });

    // Track if controller receives anything
    let controllerReceivedEcho = false;
    controllerWs.on('message', (raw) => {
      const parsed = JSON.parse(raw.toString());
      if (parsed.type === 'gesture') {
        controllerReceivedEcho = true;
      }
    });

    const gesture: GestureEventMessage = {
      version: 1,
      timestamp: Date.now(),
      type: 'gesture',
      gesture: 'jump',
      confidence: 0.98,
      source: 'manual',
    };

    controllerWs.send(JSON.stringify(gesture));

    const receivedByGame = await gameGesturePromise;
    expect(receivedByGame).toEqual(gesture);
    expect(controllerReceivedEcho).toBe(false);

    gameWs.close();
    controllerWs.close();
  });

  it('rejects invalid messages with error without crashing server', async () => {
    const ws = await createClient();
    ws.send('invalid non-json text');

    const err = await waitForMessage(ws);
    expect(err.type).toBe('error');
    expect(err.code).toBe('INVALID_JSON');

    // Server should still be healthy
    expect(server.getConnectedClientsCount().total).toBe(1);
    ws.close();
  });

  it('handles client disconnects cleanly', async () => {
    const ws = await createClient();
    ws.send(JSON.stringify({ version: 1, type: 'hello', role: 'controller' }));
    await waitForMessage(ws);

    expect(server.getConnectedClientsCount().controllers).toBe(1);
    ws.close();

    // Wait for close event propagation
    await new Promise((r) => setTimeout(r, 150));
    expect(server.getConnectedClientsCount().controllers).toBe(0);
  });
});

describe('MotionRelayServer Pairing Token Enforcement', () => {
  it('enforces pairing token when configured', async () => {
    const secureServer = new MotionRelayServer({
      port: 0,
      host: '127.0.0.1',
      pairingToken: 'secret_token_abc',
      pingIntervalMs: 5000,
      rateLimitPerSecond: 100,
    });
    const addr = await secureServer.start();

    // Client with bad token
    const wsBad = new WebSocket(`ws://127.0.0.1:${addr.port}`);
    await new Promise((r) => wsBad.on('open', r));

    wsBad.send(
      JSON.stringify({
        version: 1,
        type: 'hello',
        role: 'controller',
        pairingToken: 'wrong_token',
      })
    );

    const badResponse: any = await new Promise((resolve) => {
      wsBad.on('message', (d) => resolve(JSON.parse(d.toString())));
    });

    expect(badResponse.type).toBe('error');
    expect(badResponse.code).toBe('UNAUTHORIZED');

    // Client with correct token
    const wsGood = new WebSocket(`ws://127.0.0.1:${addr.port}`);
    await new Promise((r) => wsGood.on('open', r));

    wsGood.send(
      JSON.stringify({
        version: 1,
        type: 'hello',
        role: 'controller',
        pairingToken: 'secret_token_abc',
      })
    );

    const goodResponse: any = await new Promise((resolve) => {
      wsGood.on('message', (d) => resolve(JSON.parse(d.toString())));
    });

    expect(goodResponse.type).toBe('connected');

    wsBad.close();
    wsGood.close();
    await secureServer.close();
  });
});
