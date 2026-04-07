import { startProxies, stopProxies } from './lib/proxy/index.js';
import { logger } from './lib/logger.js';

startProxies();

// Graceful shutdown for PM2 zero-downtime reloads
process.on('SIGINT', () => {
  logger.info('Received SIGINT. Gracefully shutting down proxies...');
  stopProxies();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM. Gracefully shutting down proxies...');
  stopProxies();
  process.exit(0);
});
