# redep (Remote Deployment Tool)

> A secure, streaming deployment tool for Node.js and Docker environments. Real-time logs, multi-server support, and secure execution.

[![npm version](https://img.shields.io/npm/v/redep.svg)](https://www.npmjs.com/package/redep)
[![Docker Pulls](https://img.shields.io/docker/pulls/nafies1/redep)](https://hub.docker.com/r/nafies1/redep)
[![License](https://img.shields.io/github/license/nafies1/redep)](https://github.com/nafies1/redep/blob/main/LICENSE)
[![Build Status](https://github.com/nafies1/redep/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/nafies1/redep/actions)

## 📖 Project Overview

**redep** is a lightweight, secure Command Line Interface (CLI) designed to simplify remote deployment workflows. It solves the problem of "blind deployments" by establishing a real-time WebSocket connection between your local machine (or CI/CD runner) and your remote servers.

### Key Features

- **📺 Real-time Streaming**: Watch your deployment logs (stdout/stderr) stream live to your terminal.
- **🔒 Secure**: Uses Token-based authentication and strictly isolated command execution.
- **⚡ Multi-Server**: Manage multiple environments (Development, UAT, Production) from a single config.
- **🐳 Docker Ready**: Comes with a production-ready Docker image for instant server setup.
- **🛠️ Flexible**: Execute any command you define (`docker compose`, `kubectl`, shell scripts, etc.).

---

## 🚀 Installation

### npm Package (Client & Server)

Install globally to use the CLI on your local machine or server.

```bash
npm install -g redep
```

### Docker Image (Server Only)

Pull the official image for running the server component.

```bash
docker pull nafies1/redep:latest
```

---

## 📖 Usage Guide

### 1. Setting up the Server

The server is the agent that runs on your remote machine and executes the deployment commands.

#### Option A: Using Docker (Recommended)

**Linux / macOS (Bash):**

```bash
docker run -d \
  --name redep-server \
  --restart always \
  -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd):/app/workspace \
  -e SECRET_KEY=your-super-secret-key \
  -e WORKING_DIR=/app/workspace \
  -e DEPLOYMENT_COMMAND="docker compose pull && docker compose up -d" \
  nafies1/redep:latest
```

**Windows (PowerShell):**

```powershell
docker run -d `
  --name redep-server `
  --restart always `
  -p 3000:3000 `
  -v /var/run/docker.sock:/var/run/docker.sock `
  -v ${PWD}:/app/workspace `
  -e SECRET_KEY=your-super-secret-key `
  -e WORKING_DIR=/app/workspace `
  -e DEPLOYMENT_COMMAND="docker compose pull && docker compose up -d" `
  nafies1/redep:latest
```

#### Option B: Using npm & PM2

```bash
# Initialize configuration
redep init server
# Follow the prompts to set port, working dir, and secret key

# Start the server
redep start
```

### 2. Setting up the Client

The client runs on your local machine or CI pipeline.

```bash
# Initialize a server profile
redep init client
# ? Enter Server Name: prod
# ? Enter Server URL (Host): http://your-server-ip:3000
# ? Enter Secret Key: your-super-secret-key
```

### 3. Deploying

Trigger a deployment to your configured server.

```bash
redep deploy prod
```

You will see:

```text
(INFO) Connecting to http://your-server-ip:3000...
(SUCCESS) Connected to server. requesting deployment...
(INFO) [10:00:01 AM] Status: Deployment Started
(INFO) [10:00:02 AM] [STDOUT] Pulling images...
(INFO) [10:00:05 AM] [STDOUT] Container recreated.
(SUCCESS) [10:00:06 AM] Status: Deployment Completed
```

---

## ⚙️ Configuration

`redep` uses a hierarchical configuration system:

1.  **Environment Variables** (Highest Priority)
2.  **Config File** (Managed via CLI)

See [Advanced Configuration](docs/ADVANCED_CONFIG.md) for full details on environment variables and config management.

---

## 💻 Development Setup

### Prerequisites

- Node.js >= 18
- Docker (for testing container builds)

### Local Development

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/nafies1/redep.git
    cd redep
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Link globally (optional):**

    ```bash
    npm link
    ```

4.  **Run tests:**
    Currently, we rely on manual verification using the `test-target` directory.
    ```bash
    # Start server
    npm run start -- listen
    ```

---

## 🔄 CI/CD Pipeline

This project uses GitHub Actions for automation:

- **Build & Push Docker Image**: Triggered on new release tags. Pushes to Docker Hub.
- **Publish npm Package**: Triggered on new release tags. Publishes to npm registry.

See [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml) for details.

---

## 📚 Additional Documentation

- [Docker Guide](docs/DOCKER.md) - Full reference for Docker deployment, configuration, and security.
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md) - Solutions for common connection and auth issues.
- [Advanced Configuration](docs/ADVANCED_CONFIG.md) - Deep dive into config options and PM2.
- [API Reference](docs/API.md) - Socket.IO events and protocol details.

---

## 📄 License

This project is licensed under the ISC License.
