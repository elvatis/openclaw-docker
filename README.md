# @elvatis_com/openclaw-docker

OpenClaw plugin for Docker container management. List, inspect, start/stop containers, read logs, and manage Compose stacks through natural language.

## Features

- **Container Management** - List, start, stop, restart containers
- **Log Access** - Tail and search container logs
- **Container Inspection** - Full details: ports, volumes, env, health, resource usage
- **Compose Stacks** - Up, down, and status for Docker Compose projects
- **Image Management** - List images, pull new versions, prune unused
- **Read-Only Mode** - Optional safety mode for monitoring without control

## Installation

```bash
npm install @elvatis_com/openclaw-docker
```

## Configuration

Add to your `openclaw.json`:

```json
{
  "plugins": {
    "openclaw-docker": {
      "socketPath": "/var/run/docker.sock",
      "readOnly": false,
      "allowedOperations": ["list", "logs", "inspect", "start", "stop", "restart"],
      "composeProjects": {
        "myapp": "/opt/myapp/docker-compose.yml"
      }
    }
  }
}
```

## Agent Tools

| Tool | Description |
|---|---|
| `docker_list` | List running containers (optionally all, including stopped) |
| `docker_inspect` | Get full details of a container: ports, volumes, env, health |
| `docker_logs` | Get recent logs from a container (with tail/since options) |
| `docker_start` | Start a stopped container |
| `docker_stop` | Stop a running container |
| `docker_restart` | Restart a container |
| `docker_stats` | Get CPU/memory/network stats for running containers |
| `docker_images` | List Docker images |
| `docker_compose_status` | Show status of a Compose project |
| `docker_compose_up` | Start a Compose project |
| `docker_compose_down` | Stop a Compose project |

## Safety

- **`readOnly: true`** blocks all state-changing operations (start, stop, restart, compose up/down)
- **`allowedOperations`** whitelist restricts which operations the agent can perform
- No `docker exec` or `docker rm` by design (too dangerous for agent access)
- Socket path is configurable for rootless Docker or remote Docker hosts

## Development

```bash
git clone https://github.com/homeofe/openclaw-docker
cd openclaw-docker
npm install
npm run build
npm run test
```

## License

MIT
