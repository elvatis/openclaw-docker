# @elvatis_com/openclaw-docker

OpenClaw plugin for Docker container operations and Docker Compose project control.

## Features

- Docker daemon connection via unix socket or TCP
- Optional TLS for remote daemon access
- Read and write container tools
- Docker Compose integration via `docker compose` CLI
- Safety controls with `readOnly` and `allowedOperations`
- Configurable command timeout

## Prerequisites

- **Docker Engine** installed and running on the host
- **Docker CLI** (`docker` command) available in PATH (required for Compose operations)
- Access to the Docker socket (`/var/run/docker.sock`) or a remote Docker daemon via TCP

## Installation

```bash
npm install @elvatis_com/openclaw-docker
```

## Security Notes

- **Use `readOnly: true`** if you only need observation (ps, logs, inspect). This limits the blast radius.
- **TLS keys:** If using TCP with TLS, keep your PEM files protected. Only configure trusted certificate paths.
- **Compose directories:** The plugin runs `docker compose` commands in whichever directories you configure as `composeProjects`. Only configure trusted project paths.
- **Least privilege:** Run the plugin in an environment with minimal Docker permissions when possible.

## Configuration

### Local socket (default)

```json
{
  "plugins": {
    "openclaw-docker": {
      "socketPath": "/var/run/docker.sock",
      "readOnly": false,
      "allowedOperations": ["ps", "logs", "inspect", "stats", "start", "stop", "restart", "exec", "compose_up", "compose_down", "compose_ps"],
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

| Tool | Description | Read-only safe |
|---|---|---|
| `docker_ps` | List containers | ✅ |
| `docker_logs` | Fetch or stream container logs | ✅ |
| `docker_inspect` | Inspect container details | ✅ |
| `docker_stats` | Real-time CPU, memory, and network metrics | ✅ |
| `docker_start` | Start a stopped container | ❌ |
| `docker_stop` | Stop a running container | ❌ |
| `docker_restart` | Restart a container | ❌ |
| `docker_exec` | Execute a command inside a container | ❌ |
| `docker_compose_up` | Bring a Compose project up | ❌ |
| `docker_compose_down` | Bring a Compose project down | ❌ |
| `docker_compose_ps` | List Compose service statuses | ✅ |

## Usage Examples

- "List all running containers"
- "Show the last 200 lines from api-gateway logs"
- "Follow api-gateway logs for 30 seconds"
- "Inspect redis container"
- "Show CPU and memory usage for the api-gateway container"
- "Restart identity-service"
- "Run `ls -la /app` inside the api-gateway container"
- "Exec into redis and run `redis-cli INFO server`"
- "Bring aegis compose project up"
- "Show status of aegis compose services"

### Follow mode (docker_logs)

The `docker_logs` tool supports real-time log streaming via `follow: true`. Logs are collected for a bounded duration and returned as a single result.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `containerId` | string | (required) | Container name or ID |
| `tail` | number | 100 | Number of existing lines to include |
| `follow` | boolean | false | Enable real-time log streaming |
| `followDurationMs` | number | 10000 | How long to follow (ms), capped by `timeoutMs` |

### docker_exec

Run a command inside a running container and capture its output. Blocked by `readOnly: true`.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `containerId` | string | yes | Container name or ID |
| `command` | string[] | yes | Command and arguments (e.g. `["ls", "-la", "/app"]`) |
| `workdir` | string | no | Working directory inside the container |
| `env` | string[] | no | Additional environment variables (`["KEY=value"]`) |

Returns `{ ok, action, containerId, command, exitCode, stdout, stderr }`.

**Example:**

```json
{
  "containerId": "api-gateway",
  "command": ["cat", "/etc/os-release"],
  "workdir": "/app",
  "env": ["DEBUG=1"]
}
```

### docker_stats

Returns a single snapshot of resource usage for a running container. Safe in `readOnly` mode.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `containerId` | string | yes | Container name or ID |

Returns:

```json
{
  "containerId": "api-gateway",
  "cpuPercent": 12.34,
  "memoryUsageBytes": 48234496,
  "memoryLimitBytes": 1073741824,
  "networkRxBytes": 1536,
  "networkTxBytes": 2304
}
```

- `cpuPercent` is calculated from the delta between the current and previous CPU snapshot, multiplied by the number of online CPUs.
- `memoryUsageBytes` excludes page cache (Docker Desktop convention).
- `networkRxBytes` / `networkTxBytes` are summed across all network interfaces.

## Safety and Permissions

- `readOnly: true` allows only `ps`, `logs`, `inspect`, `stats`, and `compose_ps`
- `allowedOperations` limits which tools can be executed
- Compose operations are limited to projects in `composeProjects`
- Commands use timeout protection via `timeoutMs`

## Development

```bash
npm install
npm run build
npm test                # unit tests (mocked Docker client)
npm run test:integration # integration tests (requires running Docker daemon)
npm run test:all         # both unit and integration tests
```

### CI

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs unit tests on every push and pull request to `main`, followed by integration tests against the real Docker daemon available on the CI runner.

## Shared Template

For automation that creates GitHub issues, use `src/templates/github-issue-helper.ts`.
It provides `isValidIssueRepoSlug()`, `resolveIssueRepo()`, and `buildGhIssueCreateCommand()`.

## License

MIT
