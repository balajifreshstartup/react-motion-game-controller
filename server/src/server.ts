import crypto from 'node:crypto';
import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  PROTOCOL_VERSION,
  serializeMessage,
  validateClientMessage,
  type ClientMessage,
  type ClientRole,
  type ServerConnectedMessage,
  type ServerErrorMessage,
  type ServerPeerStatusMessage,
} from '@motion-game/protocol';
import type { ServerConfig } from './config.js';

export interface ConnectedClient {
  id: string;
  ws: WebSocket;
  role: ClientRole | 'unassigned';
  isAlive: boolean;
  messageCount: number;
}

export class MotionRelayServer {
  private config: ServerConfig;
  private httpServer: http.Server;
  private wss: WebSocketServer;
  private clients: Map<string, ConnectedClient> = new Map();
  private pingIntervalTimer: NodeJS.Timeout | null = null;
  private rateResetTimer: NodeJS.Timeout | null = null;

  constructor(config: ServerConfig) {
    this.config = config;

    this.httpServer = http.createServer((req, res) => {
      // Basic CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.url === '/health' || req.url === '/api/health') {
        const controllersCount = this.getClientsByRole('controller').length;
        const gamesCount = this.getClientsByRole('game').length;

        const payload = JSON.stringify({
          status: 'ok',
          uptime: process.uptime(),
          version: PROTOCOL_VERSION,
          clients: {
            total: this.clients.size,
            controllers: controllersCount,
            games: gamesCount,
          },
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(payload);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found. Health check available at /health');
    });

    this.wss = new WebSocketServer({
      server: this.httpServer,
      maxPayload: 8192,
    });

    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = crypto.randomUUID();
      const client: ConnectedClient = {
        id: clientId,
        ws,
        role: 'unassigned',
        isAlive: true,
        messageCount: 0,
      };

      this.clients.set(clientId, client);

      ws.on('pong', () => {
        client.isAlive = true;
      });

      ws.on('message', (data: WebSocket.RawData) => {
        this.handleMessage(client, data);
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        this.broadcastPeerStatus();
      });

      ws.on('error', (err) => {
        console.error(`[Server] Socket error on client ${clientId}:`, err.message);
        this.clients.delete(clientId);
        this.broadcastPeerStatus();
      });
    });

    // Heartbeat ping interval
    this.pingIntervalTimer = setInterval(() => {
      for (const [id, client] of this.clients.entries()) {
        if (!client.isAlive) {
          console.log(`[Server] Terminating stale client ${id}`);
          client.ws.terminate();
          this.clients.delete(id);
          continue;
        }
        client.isAlive = false;
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      }
    }, this.config.pingIntervalMs);

    // Rate limit counter reset every 1 second
    this.rateResetTimer = setInterval(() => {
      for (const client of this.clients.values()) {
        client.messageCount = 0;
      }
    }, 1000);
  }

  private handleMessage(client: ConnectedClient, rawData: WebSocket.RawData): void {
    client.messageCount++;
    if (client.messageCount > this.config.rateLimitPerSecond) {
      this.sendError(client.ws, 'RATE_LIMITED', 'Too many messages sent per second');
      return;
    }

    const validation = validateClientMessage(rawData);
    if (!validation.success) {
      this.sendError(client.ws, validation.code, validation.error);
      return;
    }

    const message: ClientMessage = validation.data;

    switch (message.type) {
      case 'hello':
        this.handleHello(client, message);
        break;
      case 'gesture':
      case 'sensor':
        this.handleRelayEvent(client, message);
        break;
      default:
        this.sendError(client.ws, 'UNSUPPORTED_TYPE', 'Unsupported message type');
    }
  }

  private handleHello(client: ConnectedClient, message: ClientMessage & { type: 'hello' }): void {
    if (this.config.pairingToken) {
      if (message.pairingToken !== this.config.pairingToken) {
        this.sendError(client.ws, 'UNAUTHORIZED', 'Invalid pairing token');
        client.ws.close(1008, 'Unauthorized');
        this.clients.delete(client.id);
        return;
      }
    }

    client.role = message.role;

    const connectedMsg: ServerConnectedMessage = {
      version: PROTOCOL_VERSION,
      type: 'connected',
      clientId: client.id,
      role: client.role,
    };

    this.send(client.ws, connectedMsg);
    this.broadcastPeerStatus();
  }

  private handleRelayEvent(client: ConnectedClient, message: ClientMessage): void {
    // Only forward gesture/sensor events to game clients
    const gameClients = this.getClientsByRole('game');
    const serialized = serializeMessage(message);

    for (const gameClient of gameClients) {
      // Do not echo back to sender if the sender was somehow a game client
      if (gameClient.id !== client.id && gameClient.ws.readyState === WebSocket.OPEN) {
        gameClient.ws.send(serialized);
      }
    }
  }

  private broadcastPeerStatus(): void {
    const controllersCount = this.getClientsByRole('controller').length;
    const gamesCount = this.getClientsByRole('game').length;

    const statusMsg: ServerPeerStatusMessage = {
      version: PROTOCOL_VERSION,
      type: 'peer_status',
      controllersCount,
      gamesCount,
    };

    const serialized = serializeMessage(statusMsg);
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(serialized);
      }
    }
  }

  private getClientsByRole(role: ClientRole): ConnectedClient[] {
    const matched: ConnectedClient[] = [];
    for (const client of this.clients.values()) {
      if (client.role === role) {
        matched.push(client);
      }
    }
    return matched;
  }

  private send(ws: WebSocket, message: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    const errorMsg: ServerErrorMessage = {
      version: PROTOCOL_VERSION,
      type: 'error',
      code,
      message,
    };
    this.send(ws, errorMsg);
  }

  public async start(): Promise<{ port: number; host: string }> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.config.port, this.config.host, () => {
        const addr = this.httpServer.address();
        const actualPort = typeof addr === 'object' && addr ? addr.port : this.config.port;
        console.log(`[Server] Motion Game WebSocket Relay running on ${this.config.host}:${actualPort}`);
        console.log(`[Server] Health check: http://${this.config.host === '0.0.0.0' ? 'localhost' : this.config.host}:${actualPort}/health`);
        resolve({ port: actualPort, host: this.config.host });
      });
    });
  }

  public async close(): Promise<void> {
    if (this.pingIntervalTimer) {
      clearInterval(this.pingIntervalTimer);
      this.pingIntervalTimer = null;
    }
    if (this.rateResetTimer) {
      clearInterval(this.rateResetTimer);
      this.rateResetTimer = null;
    }

    for (const client of this.clients.values()) {
      client.ws.terminate();
    }
    this.clients.clear();

    await new Promise<void>((resolve) => {
      this.wss.close(() => {
        this.httpServer.close(() => resolve());
      });
    });
  }

  public getConnectedClientsCount(): { total: number; controllers: number; games: number } {
    return {
      total: this.clients.size,
      controllers: this.getClientsByRole('controller').length,
      games: this.getClientsByRole('game').length,
    };
  }
}
