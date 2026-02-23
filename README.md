# @elvatis/openclaw-docker

OpenClaw plugin for Docker container operations and Docker Compose project control.

## Features

- Docker daemon connection via unix socket or TCP
- Optional TLS for remote daemon access
- Read and write container tools
- Docker Compose integration via `docker compose` CLI
- Safety controls with `readOnly` and `allowedOperations`
- Configurable command timeout

## Installation

```bash
npm install @elvatis/openclaw-docker
```

## Configuration

### Local socket (default)

```json
{
  "plugins": {
    "openclaw-docker": {
      "socketPath": "/var/run/docker.sock",
      "readOnly": false,
      "allowedOperations": ["ps", "logs", "inspect", "start", "stop", "restart", "compose_up", "compose_down"],
      "composeProjects": [
        { "name": "aegis", "path": "/opt/aegis" }
      ],
      "timeoutMs": 15000
    }
  }
}
```

### Remote Docker daemon with TLS

```json
{
  "plugins": {
    "openclaw-docker": {
      "host": "10.0.0.20",
      "port": 2376,
      "tls": {
        "caPath": "/etc/openclaw/docker/ca.pem",
        "certPath": "/etc/openclaw/docker/cert.pem",
        "keyPath": "/etc/openclaw/docker/key.pem",
        "rejectUnauthorized": true
      },
      "readOnly": true,
      "composeProjects": []
    }
  }
}
```

## Available Tools

- `docker_ps`
- `docker_logs`
- `docker_inspect`
- `docker_start`
- `docker_stop`
- `docker_restart`
- `docker_compose_up`
- `docker_compose_down`

## Usage Examples

- "List all running containers"
- "Show the last 200 lines from api-gateway logs"
- "Inspect redis container"
- "Restart identity-service"
- "Bring aegis compose project up"

## Safety and Permissions

- `readOnly: true` allows only `ps`, `logs`, and `inspect`
- `allowedOperations` limits which tools can be executed
- Compose operations are limited to projects in `composeProjects`
- Commands use timeout protection via `timeoutMs`

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
