import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import morgan from 'morgan';
import { logger } from '../logger.js';
import { getProxies } from '../config.js';

const activeServers = new Map(); // Store active HTTP servers by name

export const startProxies = () => {
  const proxies = getProxies();
  const names = Object.keys(proxies);
  
  if (names.length === 0) {
    logger.info('No proxies configured. Add one using "redep proxy add".');
    return;
  }

  names.forEach((name) => {
    startProxyInstance(name, proxies[name]);
  });
};

const startProxyInstance = (name, config) => {
  if (activeServers.has(name)) {
    logger.warn(`Proxy ${name} is already running.`);
    return;
  }

  const app = express();
  app.use(morgan('combined'));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', proxy: name, target: config.target });
  });

  // Setup proxy middleware
  app.use(
    '*',
    createProxyMiddleware({
      target: config.target,
      changeOrigin: true,
      ws: true, // support websockets
      logProvider: () => logger,
      onError: (err, req, res) => {
        logger.error(`Proxy ${name} error: ${err.message}`);
        res.status(502).send('Bad Gateway');
      },
    })
  );

  const server = app.listen(config.port, () => {
    logger.success(`Proxy ${name} listening on port ${config.port} forwarding to ${config.target}`);
  });
  
  server.on('error', (err) => {
    logger.error(`Failed to start proxy ${name} on port ${config.port}: ${err.message}`);
  });

  activeServers.set(name, server);
};

export const stopProxies = () => {
  logger.info('Shutting down all proxy instances...');
  activeServers.forEach((server, name) => {
    server.close(() => {
      logger.info(`Proxy ${name} stopped.`);
    });
  });
  activeServers.clear();
};
