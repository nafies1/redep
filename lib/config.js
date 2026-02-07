import Conf from 'conf';

const config = new Conf({
  projectName: 'redep',
  encryptionKey: 'redep-secure-storage', // Obfuscates the config file
});

export const CONFIG_SCHEMA = {
  server_port: {
    default: 3000,
    security: 'low',
    env: 'SERVER_PORT',
    description: 'Server Port',
  },
  secret_key: {
    default: null,
    security: 'critical',
    env: 'SECRET_KEY',
    description: 'Authentication Secret',
  },
  working_dir: {
    default: null,
    security: 'medium',
    env: 'WORKING_DIR',
    description: 'Working Directory',
  },
  deployment_command: {
    default: null,
    security: 'high',
    env: 'DEPLOYMENT_COMMAND',
    description: 'Deployment Command',
  },
  server_url: {
    default: null,
    security: 'low',
    env: 'SERVER_URL',
    description: 'Default Server URL',
  },
  servers: {
    default: {},
    security: 'medium',
    env: null,
    description: 'Server Profiles',
  },
  server_pid: {
    default: null,
    security: 'low',
    env: null,
    description: 'Server Process ID',
  },
};

export const getConfig = (key) => {
  // Check environment variables first (highest priority)
  if (CONFIG_SCHEMA[key] && CONFIG_SCHEMA[key].env) {
    const envValue = process.env[CONFIG_SCHEMA[key].env];
    if (envValue !== undefined) {
      return envValue;
    }
  }
  
  // Then check stored config
  const value = config.get(key);
  
  // If value is undefined but key exists in schema, return default value
  if (value === undefined && CONFIG_SCHEMA[key]) {
    return CONFIG_SCHEMA[key].default;
  }
  
  return value;
};

export const setConfig = (key, value) => {
  config.set(key, value);
  // Store metadata for timestamp
  // We use a flat key for metadata to avoid interfering with nested config objects if possible,
  // but since we want per-key tracking, we store it in a hidden _meta object.
  const now = new Date().toISOString();
  config.set(`_meta.${key}`, { updatedAt: now });
};

export const clearConfig = () => {
  config.clear();
};

export const getAllConfig = () => {
  return config.store;
};

export const getDetailedConfig = () => {
  const all = config.store;
  const meta = all._meta || {};
  const result = [];

  // Process Schema Keys
  Object.keys(CONFIG_SCHEMA).forEach((key) => {
    const schema = CONFIG_SCHEMA[key];
    const fileValue = config.get(key);
    const envValue = schema.env ? process.env[schema.env] : undefined;

    let currentValue = fileValue;
    let source = 'File';

    if (envValue !== undefined) {
      currentValue = envValue;
      source = 'Environment';
    } else if (fileValue !== undefined) {
      currentValue = fileValue;
      source = 'File';
    } else {
      currentValue = schema.default;
      source = 'Default';
    }

    result.push({
      key,
      value: currentValue,
      defaultValue: schema.default,
      source,
      security: schema.security,
      updatedAt: meta[key]?.updatedAt || 'N/A',
      description: schema.description,
    });
  });

  // Process Custom Keys (not in schema)
  Object.keys(all).forEach((key) => {
    if (!CONFIG_SCHEMA[key] && key !== '_meta') {
      result.push({
        key,
        value: all[key],
        defaultValue: undefined,
        source: 'File', // Assumed file for custom keys
        security: 'unknown',
        updatedAt: meta[key]?.updatedAt || 'N/A',
        description: 'Custom Configuration',
      });
    }
  });

  return result;
};

export const getClientConfig = () => {
  const servers = config.get('servers') || {};
  const result = [];

  Object.keys(servers).forEach((serverName) => {
    const server = servers[serverName];
    result.push({
      server: serverName,
      host: server.url || 'Not configured',
      secret_key: server.secret ? '********' : 'Not set',
      description: getServerDescription(serverName),
      security: getServerSecurityLevel(server.url),
    });
  });

  return result;
};

export const getServerConfig = () => {
  const detailed = getDetailedConfig();
  // Filter hanya konfigurasi server (bukan client servers)
  return detailed.filter((item) => 
    ['server_port', 'secret_key', 'working_dir', 'deployment_command', 'server_pid'].includes(item.key)
  );
};

function getServerDescription(serverName) {
  const descriptions = {
    prod: 'Production environment with high security',
    staging: 'Staging environment for testing',
    uat: 'User Acceptance Testing environment',
    dev: 'Development environment',
    test: 'Testing environment',
  };
  return descriptions[serverName.toLowerCase()] || 'Custom environment';
}

export const validateMandatoryConfig = () => {
  const errors = [];
  
  // Check SECRET_KEY
  const secretKey = getConfig('secret_key');
  if (!secretKey) {
    errors.push('secret_key');
  }
  
  // Check WORKING_DIR
  const workingDir = getConfig('working_dir');
  if (!workingDir) {
    errors.push('working_dir');
  }
  
  // Check DEPLOYMENT_COMMAND
  const deploymentCommand = getConfig('deployment_command');
  if (!deploymentCommand) {
    errors.push('deployment_command');
  }
  
  return errors;
};

export const getMissingConfigMessage = (missingParams) => {
  if (missingParams.length === 0) return null;
  
  const paramList = missingParams.map(param => `'${param}'`).join(', ');
  const instructions = missingParams.map(param => {
    const envVar = CONFIG_SCHEMA[param]?.env;
    if (envVar) {
      return `  - Set '${param}' using 'redep config set ${param} <value>' or add '${envVar}=<value>' to your .env file`;
    }
    return `  - Set '${param}' using 'redep config set ${param} <value>'`;
  }).join('\n');
  
  return `Error: Required configuration parameter(s) ${paramList} are not set.\n${instructions}`;
};

function getServerSecurityLevel(host) {
  if (!host) return 'unknown';
  if (host.startsWith('https://')) return 'high';
  if (host.startsWith('http://localhost') || host.startsWith('http://127.0.0.1')) return 'low';
  if (host.startsWith('http://')) return 'medium';
  return 'unknown';
};
