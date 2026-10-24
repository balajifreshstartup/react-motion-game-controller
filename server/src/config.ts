import dotenv from 'dotenv';
import path from 'node:path';

// Load root .env or local .env if present
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

export interface ServerConfig {
  port: number;
  host: string;
  pairingToken: string | null;
  pingIntervalMs: number;
  rateLimitPerSecond: number;
}

export function getServerConfig(): ServerConfig {
  const port = parseInt(process.env.PORT || '8080', 10);
  const host = process.env.HOST || '0.0.0.0';
  const pairingToken = process.env.PAIRING_TOKEN ? process.env.PAIRING_TOKEN.trim() : null;

  return {
    port: Number.isFinite(port) ? port : 8080,
    host,
    pairingToken: pairingToken && pairingToken.length > 0 ? pairingToken : null,
    pingIntervalMs: 30000,
    rateLimitPerSecond: 120,
  };
}
