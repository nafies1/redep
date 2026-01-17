#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import { spawn } from 'child_process';
import { logger } from '../lib/logger.js';
import { getConfig, setConfig, getAllConfig, clearConfig } from '../lib/config.js';
import { startServer } from '../lib/server/index.js';
import { deploy } from '../lib/client/index.js';

const program = new Command();

program
  .name('redep')
  .description('Remote execution CLI for deployment')
  .version('1.0.0');

// Configuration Command
const configCommand = new Command('config')
  .description('Manage configuration');

configCommand
  .command('set <key> <value>')
  .description('Set a configuration key')
  .action((key, value) => {
    setConfig(key, value);
    logger.success(`Configuration updated: ${key} = ${value}`);
  });

configCommand
  .command('get <key>')
  .description('Get a configuration key')
  .action((key) => {
    const value = getConfig(key);
    logger.info(`${key}: ${value}`);
  });

configCommand
  .command('list')
  .description('List all configurations')
  .action(() => {
    const all = getAllConfig();
    logger.info('Current Configuration:');
    console.table(all);
  });

configCommand
  .command('clear')
  .description('Clear all configurations')
  .action(() => {
    clearConfig();
    logger.success('All configurations have been cleared.');
  });

program.addCommand(configCommand);

// Background Process Management
program
  .command('start')
  .description('Start the server in background (daemon mode) using PM2 if available')
  .option('-p, --port <port>', 'Port to listen on')
  .action((options) => {
    // Try to use PM2 first
    try {
      // Check if PM2 is available via API
      // We'll use a dynamic import or checking for the pm2 binary in a real scenario
      // But here we can just try to spawn 'pm2' command
      
      const args = ['start', process.argv[1], '--name', 'redep-server', '--', 'listen'];
      if (options.port) {
        args.push('--port', options.port);
      }

      const pm2 = spawn('pm2', args, {
        stdio: 'inherit',
        shell: true // Required to find pm2 in PATH
      });

      pm2.on('error', () => {
        // Fallback to native spawn if PM2 is not found/fails
        logger.info('PM2 not found, falling back to native background process...');
        startNativeBackground(options);
      });

      pm2.on('close', (code) => {
        if (code !== 0) {
           logger.warn('PM2 start failed, falling back to native background process...');
           startNativeBackground(options);
        } else {
           logger.success('Server started in background using PM2');
        }
      });

    } catch (e) {
      startNativeBackground(options);
    }
  });

function startNativeBackground(options) {
    const existingPid = getConfig('server_pid');
    
    if (existingPid) {
      try {
        process.kill(existingPid, 0);
        logger.warn(`Server is already running with PID ${existingPid}`);
        return;
      } catch (e) {
        // Process doesn't exist, clear stale PID
        setConfig('server_pid', null);
      }
    }

    const args = ['listen'];
    if (options.port) {
      args.push('--port', options.port);
    }

    const child = spawn(process.argv[0], [process.argv[1], ...args], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });

    child.unref();
    setConfig('server_pid', child.pid);
    logger.success(`Server started in background (native) with PID ${child.pid}`);
}

program
  .command('stop')
  .description('Stop the background server')
  .action(() => {
    // Try PM2 stop first
    const pm2 = spawn('pm2', ['stop', 'redep-server'], { stdio: 'ignore', shell: true });
    
    pm2.on('close', (code) => {
      if (code === 0) {
        logger.success('Server stopped (PM2)');
        return;
      }
      
      // Fallback to native stop
      const pid = getConfig('server_pid');
      if (!pid) {
        logger.warn('No active server found.');
        return;
      }

      try {
        process.kill(pid);
        setConfig('server_pid', null);
        logger.success(`Server stopped (PID ${pid})`);
      } catch (e) {
        if (e.code === 'ESRCH') {
          logger.warn(`Process ${pid} not found. Cleaning up config.`);
          setConfig('server_pid', null);
        } else {
          logger.error(`Failed to stop server: ${e.message}`);
        }
      }
    });
  });

program
  .command('status')
  .description('Check server status')
  .action(() => {
     // Try PM2 status first
     const pm2 = spawn('pm2', ['describe', 'redep-server'], { stdio: 'inherit', shell: true });

     pm2.on('close', (code) => {
        if (code !== 0) {
             // Fallback to native status
            const pid = getConfig('server_pid');
            
            if (!pid) {
              logger.info('Server is NOT running.');
              return;
            }

            try {
              process.kill(pid, 0);
              logger.success(`Server is RUNNING (PID ${pid})`);
            } catch (e) {
              logger.warn(`Server is NOT running (Stale PID ${pid} found).`);
              setConfig('server_pid', null);
            }
        }
     });
  });

// Server Command
program
  .command('listen')
  .description('Start the server to listen for commands')
  .option('-p, --port <port>', 'Port to listen on', 3000)
  .action((options) => {
    const port = options.port || getConfig('server_port') || process.env.SERVER_PORT || 3000;
    const secret = getConfig('secret_key') || process.env.SECRET_KEY;
    
    if (!secret) {
      logger.warn('Warning: No "secret_key" set in config or SECRET_KEY env var. Communication might be insecure or fail if client requires it.');
      logger.info('Run "redep config set secret_key <your-secret>" or set SECRET_KEY env var.');
    }

    const workingDir = getConfig('working_dir') || process.env.WORKING_DIR;
    if (!workingDir) {
      logger.error('Error: "working_dir" is not set. Please set it using "redep config set working_dir <path>" or WORKING_DIR env var.');
      process.exit(1);
    }

    startServer(port, secret, workingDir);
  });

// Client Command
program
  .command('deploy <type>')
  .description('Deploy a service (e.g., "fe") to the server machine')
  .action(async (type) => {
    const serverUrl = getConfig('server_url') || process.env.SERVER_URL;
    const secret = getConfig('secret_key') || process.env.SECRET_KEY;

    if (!serverUrl) {
      logger.error('Error: "server_url" is not set. Set SERVER_URL env var or run "redep config set server_url <url>"');
      process.exit(1);
    }

    if (!secret) {
      logger.error('Error: "secret_key" is not set. Set SECRET_KEY env var or run "redep config set secret_key <your-secret>"');
      process.exit(1);
    }

    try {
      await deploy(type, serverUrl, secret);
    } catch (error) {
      logger.error(`Deploy failed: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
