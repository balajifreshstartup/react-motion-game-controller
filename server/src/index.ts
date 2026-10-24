import { getServerConfig } from './config.js';
import { MotionRelayServer } from './server.js';

const config = getServerConfig();
const server = new MotionRelayServer(config);

async function main() {
  await server.start();

  const shutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
