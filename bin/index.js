#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import { spawn } from 'child_process';
import crypto from 'crypto';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import chalk from 'chalk';
import { logger } from '../lib/logger.js';
import { getConfig, setConfig, getAllConfig, clearConfig, getDetailedConfig, getClientConfig, getServerConfig, validateMandatoryConfig, getMissingConfigMessage } from '../lib/config.js';
import { startServer } from '../lib/server/index.js';
import { deploy } from '../lib/client/index.js';
import pkg from '../package.json' with { type: 'json' };

const program = new Command();

program.name('redep').description(pkg.description).version(pkg.version);

// Helper to generate secure token
const generateSecureToken = (length = 32) => {
  return crypto
    .randomBytes(Math.ceil(length * 0.75))
    .toString('base64')
    .slice(0, length)
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

// Init Command
program
  .command('init <type>')
  .description('Initialize configuration for client or server')
  .action(async (type) => {
    if (type !== 'client' && type !== 'server') {
      logger.error('Type must be either "client" or "server"');
      process.exit(1);
    }

    try {
      if (type === 'client') {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'server_name',
            message: 'Enter Server Name:',
            default: 'prod',
            validate: (input) => (input ? true : 'Server Name is required'),
          },
          {
            type: 'input',
            name: 'server_url',
            message: 'Enter Server URL (Host):',
            validate: (input) => (input ? true : 'Server URL is required'),
          },
          {
            type: 'input',
            name: 'secret_key',
            message: 'Enter Secret Key:',
            validate: (input) => (input ? true : 'Secret Key is required'),
          },
        ]);

        const servers = getConfig('servers') || {};
        servers[answers.server_name] = {
          url: answers.server_url,
          secret: answers.secret_key,
        };
        setConfig('servers', servers);
        logger.success(`Client configuration for '${answers.server_name}' saved successfully.`);
      } else {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'server_port',
            message: 'Enter Server Port:',
            default: '3000',
            validate: (input) => (!isNaN(input) ? true : 'Port must be a number'),
          },
          {
            type: 'input',
            name: 'working_dir',
            message: 'Enter Working Directory:',
            validate: (input) => (input ? true : 'Working Directory is required'),
          },
          {
            type: 'input',
            name: 'deployment_command',
            message: 'Enter Custom Deployment Command (Optional):',
          },
          {
            type: 'input',
            name: 'secret_key',
            message: 'Enter Secret Key (Leave empty to generate):',
          },
        ]);

        let secret = answers.secret_key;
        if (!secret) {
          secret = generateSecureToken();
          logger.info(`Generated Secret Key: ${secret}`);
        }

        setConfig('server_port', answers.server_port);
        setConfig('working_dir', answers.working_dir);
        if (answers.deployment_command) {
          setConfig('deployment_command', answers.deployment_command);
        }
        setConfig('secret_key', secret);
        logger.success('Server configuration saved successfully.');
      }
    } catch (error) {
      logger.error(`Initialization failed: ${error.message}`);
      process.exit(1);
    }
  });

// Generate Command
const generateCommand = new Command('generate').description('Generate configuration values');

generateCommand
  .command('secret_key')
  .description('Generate a new secret key')
  .action(() => {
    try {
      const secret = generateSecureToken();
      setConfig('secret_key', secret);
      logger.success(`Secret Key generated and saved: ${secret}`);
    } catch (error) {
      logger.error(`Generation failed: ${error.message}`);
    }
  });

generateCommand
  .command('working_dir')
  .description('Set working directory to current path')
  .action(() => {
    try {
      const cwd = process.cwd();
      setConfig('working_dir', cwd);
      logger.success(`Working Directory set to: ${cwd}`);
    } catch (error) {
      logger.error(`Failed to set working directory: ${error.message}`);
    }
  });

program.addCommand(generateCommand);

// Configuration Command
const configCommand = new Command('config').description('Manage configuration');

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
  .command('list [type]')
  .description('List configurations (client, server, or all)')
  .option('--json', 'Output as JSON')
  .option('--sort <field>', 'Sort by: key, modified, source, security', 'key')
  .action((type, options) => {
    // Handle different list types
    if (type === 'client') {
      const clientConfig = getClientConfig();
      
      if (options.json) {
        console.log(JSON.stringify(clientConfig, null, 2));
        return;
      }

      if (clientConfig.length === 0) {
        logger.warn('No client servers configured. Use "redep init client" to add servers.');
        return;
      }

      // Create table for client config
      const table = new Table({
        head: ['Server', 'Host', 'Secret Key', 'Description', 'Security'],
        style: { head: ['bold', 'white'] },
        wordWrap: true,
        colWidths: [15, 35, 15, 30, 12],
      });

      clientConfig.forEach((item) => {
        let server = item.server;
        let host = item.host;
        let secret = item.secret_key;
        let description = item.description;
        let security = item.security;

        // Color coding based on security
        if (item.security === 'high') {
          security = chalk.green(security);
          server = chalk.green(server);
        } else if (item.security === 'medium') {
          security = chalk.yellow(security);
          server = chalk.yellow(server);
        } else if (item.security === 'low') {
          security = chalk.cyan(security);
          server = chalk.cyan(server);
        }

        table.push([server, host, secret, description, security]);
      });

      logger.info('Client Server Configurations:');
      console.log(table.toString());
      
    } else if (type === 'server') {
      const serverConfig = getServerConfig();
      
      if (options.json) {
        console.log(JSON.stringify(serverConfig, null, 2));
        return;
      }

      // Create table for server config
      const table = new Table({
        head: ['Key', 'Value', 'Default', 'Source', 'Updated', 'Security'],
        style: { head: ['bold', 'white'] },
        wordWrap: true,
        colWidths: [20, 30, 15, 15, 25, 10],
      });

      serverConfig.forEach((item) => {
        let key = item.key;
        let value = typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value || '');
        let def = typeof item.defaultValue === 'object' ? JSON.stringify(item.defaultValue) : String(item.defaultValue !== undefined ? item.defaultValue : '-');
        let source = item.source;
        let updated = item.updatedAt === 'N/A' ? '-' : new Date(item.updatedAt).toLocaleString();
        let security = item.security || 'unknown';

        // Color coding
        if (item.source === 'Environment') {
          source = chalk.cyan(source);
          key = chalk.cyan(key);
        } else if (item.isModified) {
          source = chalk.yellow(source);
          key = chalk.yellow(key);
        }

        if (['critical', 'high'].includes(item.security)) {
          security = chalk.red(security);
          if (item.security === 'critical') value = '********';
        }

        table.push([key, value, def, source, updated, security]);
      });

      logger.info('Server Configuration:');
      console.log(table.toString());

    } else {
      // Default behavior - show all config (backward compatibility)
      const detailed = getDetailedConfig();

      // Sorting Logic
      detailed.sort((a, b) => {
        if (options.sort === 'key') return a.key.localeCompare(b.key);
        if (options.sort === 'modified') return (b.updatedAt || '').localeCompare(a.updatedAt || '');
        if (options.sort === 'source') return a.source.localeCompare(b.source);
        if (options.sort === 'security') {
          const levels = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };
          return (levels[a.security] || 4) - (levels[b.security] || 4);
        }
        return 0;
      });

      if (options.json) {
        console.log(JSON.stringify(detailed, null, 2));
        return;
      }

      // Table Setup (existing code)
      const table = new Table({
        head: ['Key', 'Value', 'Default', 'Source', 'Updated', 'Sec'],
        style: { head: ['bold', 'white'] },
        wordWrap: true,
        colWidths: [20, 30, 15, 15, 25, 10],
      });

      let stats = { total: 0, modified: 0, env: 0, security: 0 };

      detailed.forEach((item) => {
        stats.total++;
        if (item.source === 'Environment') stats.env++;
        if (item.isModified) stats.modified++;
        if (['critical', 'high'].includes(item.security)) stats.security++;

        let key = item.key;
        let value = typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value || '');
        let def = typeof item.defaultValue === 'object' ? JSON.stringify(item.defaultValue) : String(item.defaultValue !== undefined ? item.defaultValue : '-');
        let source = item.source;
        let updated = item.updatedAt === 'N/A' ? '-' : new Date(item.updatedAt).toLocaleString();
        let sec = item.security || 'unknown';

        // Color Coding
        if (item.source === 'Environment') {
          source = chalk.cyan(source);
          key = chalk.cyan(key);
        } else if (item.isModified) {
          source = chalk.yellow(source);
          key = chalk.yellow(key);
        }

        if (['critical', 'high'].includes(item.security)) {
          sec = chalk.red(sec);
          if (item.security === 'critical') value = '********';
        }

        table.push([key, value, def, source, updated, sec]);
      });

      logger.info('Current Configuration:');
      console.log(table.toString());

      // Summary Statistics
      console.log('\nSummary Statistics:');
      console.log(
        `Total: ${stats.total} | Modified: ${chalk.yellow(stats.modified)} | Env Overrides: ${chalk.cyan(
          stats.env
        )} | Security Critical: ${chalk.red(stats.security)}`
      );

      // Help Section
      console.log('\nLegend:');
      console.log(
        `${chalk.cyan('Cyan')}: Environment Override | ${chalk.yellow(
          'Yellow'
        )}: Modified/File | ${chalk.red('Red')}: High Security`
      );
    }
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
    // Validate mandatory configuration before starting
    const missingParams = validateMandatoryConfig();
    if (missingParams.length > 0) {
      const errorMessage = getMissingConfigMessage(missingParams);
      logger.error(errorMessage);
      process.exit(1);
    }

    // Try to use PM2 first
    try {
      // Check if PM2 is available via API
      // We'll use a dynamic import or checking for the pm2 binary in a real scenario
      // But here we can just try to spawn 'pm2' command

      // Use dedicated server entry point for PM2 to avoid CLI/ESM issues
      // Resolve absolute path to server-entry.js
      const scriptPath = new URL('../server-entry.js', import.meta.url).pathname.replace(
        /^\/([A-Za-z]:)/,
        '$1'
      );

      const args = ['start', scriptPath, '--name', 'redep-server'];

      // We don't pass 'listen' arg because server-entry.js starts immediately
      // But we do need to ensure env vars are passed if port is customized

      const env = { ...process.env };
      if (options.port) {
        env.SERVER_PORT = options.port;
      }

      const pm2 = spawn('pm2', args, {
        stdio: 'inherit',
        shell: true,
        env: env, // Pass modified env with port
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
    windowsHide: true,
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
  .option('-p, --port <port>', 'Port to listen on')
  .action((options) => {
    // Validate mandatory configuration before starting
    const missingParams = validateMandatoryConfig();
    if (missingParams.length > 0) {
      const errorMessage = getMissingConfigMessage(missingParams);
      logger.error(errorMessage);
      process.exit(1);
    }

    const port = options.port || getConfig('server_port') || process.env.SERVER_PORT || 3000;
    const secret = getConfig('secret_key') || process.env.SECRET_KEY;

    const workingDir = getConfig('working_dir') || process.env.WORKING_DIR;
    const deploymentCommand = getConfig('deployment_command') || process.env.DEPLOYMENT_COMMAND;

    startServer(port, secret, workingDir, deploymentCommand);
  });

// Client Command
program
  .command('deploy <serverName>')
  .description('Deploy to a specific server (e.g., "prod")')
  .action(async (serverName) => {
    const servers = getConfig('servers') || {};
    let serverUrl, secret;

    if (servers[serverName]) {
      serverUrl = servers[serverName].url;
      secret = servers[serverName].secret;
    } else {
      serverUrl = getConfig('server_url') || process.env.SERVER_URL;
      secret = getConfig('secret_key') || process.env.SECRET_KEY;
    }

    if (!serverUrl) {
      logger.error(
        `Error: Server "${serverName}" not found in config, and global "server_url" is not set.`
      );
      logger.info('Run "redep init client" to configure a server.');
      process.exit(1);
    }

    if (!secret) {
      logger.error(
        'Error: "secret_key" is not set. Set SECRET_KEY env var or run "redep config set secret_key <your-secret>"'
      );
      process.exit(1);
    }

    try {
      await deploy(serverName, serverUrl, secret);
    } catch (error) {
      logger.error(`Deploy failed: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
