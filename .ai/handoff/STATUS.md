# openclaw-docker — Status

> Last updated: 2026-02-22 (initial setup)
> Phase: P0 — Project initialized, not yet started

## Project Overview

**Package:** `@elvatis/openclaw-docker`
**Repo:** https://github.com/homeofe/openclaw-docker
**Purpose:** Docker container management as OpenClaw agent tools — list, inspect, start/stop, logs, Compose stacks.

## Build Health

| Component         | Status       | Notes                              |
| ----------------- | ------------ | ---------------------------------- |
| Repo / Structure  | (Verified)   | Initialized 2026-02-22             |
| Plugin manifest   | (Unknown)    | Not yet created                    |
| Docker client     | (Unknown)    | dockerode npm package              |
| Agent tools       | (Unknown)    | Not yet implemented                |
| Tests             | (Unknown)    | Not yet created                    |
| npm publish       | (Unknown)    | Not yet published                  |

## Architecture Decision

- **Docker client:** `dockerode` npm package (unix socket or TCP)
- **Connection:** /var/run/docker.sock (local) or tcp://host:2376 with TLS (remote)
- **Agent Tools:** docker_list, docker_logs, docker_inspect, docker_start/stop/restart, docker_compose_up/down
- **Safety:** allowedOperations config (can restrict to read-only: list, logs, inspect)
- **Compose support:** named compose projects mapped to paths in config

## Open Questions

- Local socket or also remote Docker daemon support needed?
- Compose project paths to pre-configure (PRIVATE_PROJECT stack confirmed)
