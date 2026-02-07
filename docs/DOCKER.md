# 🐳 Docker Configuration & Usage Guide

This guide provides comprehensive instructions for running `redep` server using Docker. The Docker image is optimized for size and security, based on Alpine Linux.

## 🚀 Quick Start

### 1. Pull the Image

```bash
docker pull nafies1/redep:latest
```

### 2. Run the Server

To run the server, you need to provide a **Secret Key** and mount the **Docker Socket** (so `redep` can execute Docker commands on the host).

#### Linux / macOS (Bash)

```bash
docker run -d \
  --name redep-server \
  --restart always \
  -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd)/workspace:/app/workspace \
  -e SECRET_KEY=your-super-secret-key \
  -e WORKING_DIR=/app/workspace \
  -e DEPLOYMENT_COMMAND="docker compose up -d" \
  nafies1/redep:latest
```

#### Windows (PowerShell)

```powershell
docker run -d `
  --name redep-server `
  --restart always `
  -p 3000:3000 `
  -v /var/run/docker.sock:/var/run/docker.sock `
  -v ${PWD}/workspace:/app/workspace `
  -e SECRET_KEY=your-super-secret-key `
  -e WORKING_DIR=/app/workspace `
  -e DEPLOYMENT_COMMAND="docker compose up -d" `
  nafies1/redep:latest
```

#### Windows (Command Prompt)

```cmd
docker run -d ^
  --name redep-server ^
  --restart always ^
  -p 3000:3000 ^
  -v /var/run/docker.sock:/var/run/docker.sock ^
  -v %cd%/workspace:/app/workspace ^
  -e SECRET_KEY=your-super-secret-key ^
  -e WORKING_DIR=/app/workspace ^
  -e DEPLOYMENT_COMMAND="docker compose up -d" ^
  nafies1/redep:latest
```

---

## ⚙️ Configuration Reference

### Environment Variables

| Variable             | Description                                                 | Default      | Required |
| -------------------- | ----------------------------------------------------------- | ------------ | -------- |
| `SECRET_KEY`         | Secret token for authentication with the client.            | -            | **Yes**  |
| `WORKING_DIR`        | Directory inside the container where commands are executed. | -            | **Yes**  |
| `DEPLOYMENT_COMMAND` | Command to execute when a deployment is triggered.          | -            | **Yes**  |
| `SERVER_PORT`        | Port the server listens on inside the container.            | `3000`       | No       |
| `NODE_ENV`           | Node.js environment mode.                                   | `production` | No       |

### Volume Mounts

| Host Path              | Container Path         | Purpose                                                                                                      |
| ---------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `/var/run/docker.sock` | `/var/run/docker.sock` | **Required**. Allows the container to control the host's Docker daemon.                                      |
| `./workspace`          | `/app/workspace`       | **Recommended**. Persist your project files (e.g., `docker-compose.yml`) so they survive container restarts. |

---

## 📦 Docker Compose Examples

### Basic Setup

Create a `docker-compose.redep.yml`:

```yaml
services:
  redep-server:
    image: nafies1/redep:latest
    container_name: redep-server
    restart: always
    ports:
      - '3000:3000'
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./my-project:/app/workspace
    environment:
      - SECRET_KEY=change-me-to-something-secure
      - WORKING_DIR=/app/workspace
      - DEPLOYMENT_COMMAND=docker compose pull && docker compose up -d
```

Run with:

```bash
docker compose -f docker-compose.redep.yml up -d
```

### Advanced Setup (Traefik + Watchtower)

```yaml
services:
  redep-server:
    image: nafies1/redep:latest
    networks:
      - web
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./workspace:/app/workspace
    environment:
      - SECRET_KEY=${REDEP_SECRET}
      - WORKING_DIR=/app/workspace
      - DEPLOYMENT_COMMAND=docker compose up -d --build
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.redep.rule=Host(`deploy.example.com`)'

networks:
  web:
    external: true
```

---

## 🛠️ Troubleshooting

### 1. "Docker command not found" or Permission Denied

- **Symptom**: Deployment logs show `docker: not found` or `permission denied`.
- **Cause**: The container cannot access the host's Docker socket.
- **Fix**: Ensure you passed `-v /var/run/docker.sock:/var/run/docker.sock`. On some systems, you may need to run the container with `--group-add $(getent group docker | cut -d: -f3)` or `user: root` (though root is not recommended if avoidable).

### 2. "Connection Refused"

- **Symptom**: Client says `xhr poll error`.
- **Cause**: The server is not running, or the port is not mapped correctly.
- **Fix**: Check `docker ps`. Ensure `-p 3000:3000` matches the internal `SERVER_PORT`.

### 3. "Directory not found"

- **Symptom**: Error regarding `WORKING_DIR`.
- **Fix**: Ensure the `WORKING_DIR` path exists inside the container. Mounting a volume automatically creates the directory.

---

## 🔒 Security Best Practices

1.  **Least Privilege**: The container runs as `root` by default to access the Docker socket easily. For higher security, consider using a non-root user and adding them to the docker group (requires custom image extension).
2.  **Network Isolation**: Don't expose port 3000 to the public internet directly. Use a reverse proxy (Nginx, Traefik) with SSL/TLS and IP whitelisting if possible.
3.  **Secret Management**: Do not commit your `SECRET_KEY` to version control. Use `.env` files (excluded from git) or Docker Secrets.
4.  **Socket Exposure**: Mounting `/var/run/docker.sock` gives the container full control over the host. Ensure only trusted commands are executed via `DEPLOYMENT_COMMAND`.

---

## 🚀 Performance Tuning

- **Base Image**: We use `node:20-alpine` for a lightweight footprint (<100MB).
- **Memory Limit**: The server is lightweight. You can limit memory usage:
  ```bash
  --memory="256m" --cpus="0.5"
  ```
- **Layer Caching**: The Dockerfile uses multi-stage builds. Dependencies are cached in a separate layer, so rebuilding the image after code changes is fast.

## 📋 Version Compatibility

| redep Version | Docker Tag | Node.js Version |
| ------------- | ---------- | --------------- |
| 2.x           | `latest`   | 20 (LTS)        |
| 1.x           | `v1`       | 18              |

## 🔗 Additional Resources

- [Official Docker Documentation](https://docs.docker.com/)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)
