# Advanced Configuration

## Server Configuration

The server can be configured via Environment Variables or the CLI configuration store. Environment variables take precedence.

| Variable             | Config Key           | Description                                                                | Default |
| -------------------- | -------------------- | -------------------------------------------------------------------------- | ------- |
| `SERVER_PORT`        | `server_port`        | The TCP port the server listens on.                                        | `3000`  |
| `SECRET_KEY`         | `secret_key`         | A shared secret string for authentication. **Required**.                   | -       |
| `WORKING_DIR`        | `working_dir`        | The absolute path where the deployment command is executed. **Required**.  | -       |
| `DEPLOYMENT_COMMAND` | `deployment_command` | The shell command to execute when a deployment is triggered. **Required**. | -       |

### Using PM2

For production usage without Docker, we recommend using PM2.

```bash
# Start with PM2
pm2 start server-entry.js --name redep-server --env SECRET_KEY=xyz --env WORKING_DIR=/app
```

The CLI `redep start` command automatically attempts to use PM2 if installed.

## Client Configuration

Clients can be configured to talk to multiple servers (e.g., `dev`, `staging`, `prod`).

### Client Server Configuration Table

| Servers   | Host                          | Secret Key       | Description                         |
| --------- | ----------------------------- | ---------------- | ----------------------------------- |
| `prod`    | `https://deploy.example.com`  | `prod-secret`    | Production server with HTTPS        |
| `staging` | `http://10.0.0.5:3000`        | `staging-secret` | Staging server on internal network  |
| `uat`     | `http://uat.company.com:3000` | `uat-secret`     | User Acceptance Testing environment |
| `dev`     | `http://localhost:3000`       | `dev-secret`     | Local development server            |

### Viewing Client Configuration

Use the new `redep config list client` command to display your client configurations in a structured table format:

```bash
# Display all client server configurations
redep config list client

# Display with custom sorting
redep config list client --sort host
```

This will show a formatted table with columns for Server Name, Host URL, and Security Level, making it easy to review all your configured deployment targets.

### Managing Servers via CLI

```bash
# Set a server
redep config set servers.dev.host http://localhost:3000
redep config set servers.dev.secret_key mysecret

# Get a server config
redep config get servers.dev
```

### Viewing Configuration with New List Commands

The enhanced `redep config list` command now supports viewing client and server configurations separately:

```bash
# View all client server configurations
redep config list client

# View server configuration only
redep config list server

# View all configurations (backward compatibility)
redep config list

# View with JSON output
redep config list client --json
redep config list server --json
```

**Client Configuration Table Example:**

```
┌─────────┬──────────────────────────────┬─────────────┬─────────────────────────────────────┬──────────┐
│ Server  │ Host                         │ Secret Key  │ Description                         │ Security │
├─────────┼──────────────────────────────┼─────────────┼─────────────────────────────────────┼──────────┤
│ prod    │ https://deploy.example.com   │ ********    │ Production environment with HTTPS   │ high     │
│ staging │ http://10.0.0.5:3000         │ ********    │ Staging environment for testing     │ medium   │
│ uat     │ http://uat.company.com:3000  │ ********    │ User Acceptance Testing environment │ medium   │
│ dev     │ http://localhost:3000        │ ********    │ Local development server            │ low      │
└─────────┴──────────────────────────────┴─────────────┴─────────────────────────────────────┴──────────┘
```

**Server Configuration Table Example:**

```
┌────────────────────┬──────────────────────────────┬───────────────┬───────────────┬─────────────────────────┬──────────┐
│ Key                │ Value                        │ Default       │ Source        │ Updated                 │ Security │
├────────────────────┼──────────────────────────────┼───────────────┼───────────────┼─────────────────────────┼──────────┤
│ server_port        │ 3000                         │ 3000          │ Environment   │ 2026-01-22 14:28:14     │ low      │
│ secret_key         │ ********                     │ null          │ File          │ 2026-01-22 14:30:22     │ critical │
│ working_dir        │ /app/workspace               │ null          │ Environment   │ -                       │ medium   │
│ deployment_command │ docker compose up -d         │ null          │ File          │ -                       │ high     │
└────────────────────┴──────────────────────────────┴───────────────┴───────────────┴─────────────────────────┴──────────┘
```

## Security Best Practices

1.  **TLS/SSL**: Always use HTTPS for the `host` URL in production. The WebSocket connection will automatically use WSS (Secure WebSocket).
2.  **Secret Rotation**: Rotate your `SECRET_KEY` periodically.
3.  **Firewall**: Restrict access to the server port (3000) to known IP addresses (e.g., your VPN or CI/CD runner IPs).
4.  **Least Privilege**: Run the server process with a user that has only the necessary permissions (e.g., access to Docker socket and the working directory).
