# @elvatis/openclaw-docker

OpenClaw plugin for Docker container management. Monitor, start, stop, and inspect containers and stacks through your AI assistant.

## What it does

Connects to the local (or remote) Docker daemon and exposes container management as agent tools. The AI can list running containers, check health, start/stop services, tail logs, and manage Docker Compose stacks.

## Use cases

- "Is the PRIVATE_PROJECT stack running? Show me the health status"
- "Restart the api-gateway container"
- "Show me the last 50 lines of logs from the identity-service"
- "Which containers are unhealthy right now?"
- "Start the dev environment"

## Architecture

```
OpenClaw (agent)
  └── @elvatis/openclaw-docker plugin
        └── Docker SDK (dockerode)
              ├── /var/run/docker.sock (local)
              └── tcp://host:2376 (remote, TLS)
```

## Installation

```bash
openclaw plugins install @elvatis/openclaw-docker
```

## Configuration

```json
{
  "plugins": {
    "entries": {
      "openclaw-docker": {
        "config": {
          "socketPath": "/var/run/docker.sock",
          "readOnly": false,
          "allowedOperations": ["list", "logs", "inspect", "start", "stop", "restart"],
          "composeProjects": {
            "aegis": "~/.openclaw/workspace/PRIVATE_PROJECT"
          }
        }
      }
    }
  }
}
```

## Agent Tools registered

- `docker_list` - List containers with status/health
- `docker_logs` - Get container logs (last N lines)
- `docker_inspect` - Inspect container details
- `docker_start` / `docker_stop` / `docker_restart` - Lifecycle management
- `docker_compose_up` / `docker_compose_down` - Compose stack management

## Status

Work in progress. See `.ai/handoff/STATUS.md` for current build state.
