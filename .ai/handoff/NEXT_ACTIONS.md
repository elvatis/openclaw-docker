# NEXT_ACTIONS - openclaw-docker

## ⚡ Ready - Work These Next

### T-005: Add docker_exec tool for running commands inside containers [high] (issue #1)
- **Goal:** Allow users to execute commands inside running containers (e.g., "run `ls /app` inside api-gateway")
- **Context:** Exec is one of the most common Docker operations, used for debugging, health checks, and ad-hoc maintenance. All 9 existing tools cover container lifecycle and observation, but none let you run a command inside a container. Dockerode provides `container.exec()` and `exec.start()` APIs for this.
- **What to do:**
  1. Add `"exec"` to the `DockerOperation` union in `src/types.ts`
  2. Add `"exec"` to the `allowedOperations` enum in `openclaw.plugin.json`
  3. Implement `docker_exec` in `src/tools.ts` - accept `containerId`, `command` (string[]), optional `workdir`, optional `env` (string[]), return stdout/stderr as text
  4. Register the tool in `src/index.ts`
  5. Add unit test in `test/tools.test.ts` (mock exec + start)
  6. Add integration test in `test/integration/docker.test.ts` (exec `echo hello` in alpine)
  7. Update README.md with the new tool and usage example
  8. Guard it as a write operation (blocked by readOnly)
- **Files:** `src/types.ts`, `src/tools.ts`, `src/index.ts`, `src/guards.ts`, `openclaw.plugin.json`, `test/tools.test.ts`, `test/integration/docker.test.ts`, `README.md`
- **Definition of Done:**
  - [ ] `docker_exec` tool registered and functional
  - [ ] Blocked by readOnly mode and allowedOperations guard
  - [ ] Unit test with mocked exec passes
  - [ ] Integration test executes a command in a real container
  - [ ] README documents the new tool with an example
  - [ ] `npm run build` and `npm test` pass

### T-006: Add unit tests for write operations [medium] (issue #2)
- **Goal:** Close the unit test coverage gap for docker_start, docker_stop, docker_restart, compose_up, and compose_down
- **Context:** Currently these 5 tools have zero unit tests - they are only exercised by integration tests that require a running Docker daemon. The read tools (ps, logs, inspect) and compose_ps all have mocked unit tests. Adding unit tests for the write tools ensures regressions are caught in the fast CI job without needing Docker.
- **What to do:**
  1. Add unit tests for `docker_start` - mock `container.start()`, verify guard is called, verify return shape
  2. Add unit tests for `docker_stop` - mock `container.stop()`, verify timeout default (10s), verify return shape
  3. Add unit tests for `docker_restart` - mock `container.restart()`, verify timeout default, verify return shape
  4. Add unit tests for `docker_compose_up` - mock composeRunner, verify `-d` flag by default, verify without detached
  5. Add unit tests for `docker_compose_down` - mock composeRunner, verify `--volumes` flag when requested
  6. Add error-path tests for at least one write tool (verify error wrapping)
- **Files:** `test/tools.test.ts`
- **Definition of Done:**
  - [ ] All 5 write tools have at least one happy-path unit test
  - [ ] At least one error-path test for a write tool
  - [ ] `npm test` passes with no regressions

### T-007: Add docker_stats tool for container resource monitoring [medium] (issue #3)
- **Goal:** Expose container CPU, memory, and network I/O metrics via a new read-only tool
- **Context:** The plugin already has strong observability tools (ps, logs, inspect), but lacks resource usage data. Container stats are commonly needed for monitoring and capacity planning. Dockerode provides `container.stats({ stream: false })` which returns a single stats snapshot without streaming.
- **What to do:**
  1. Add `"stats"` to `DockerOperation` union in `src/types.ts`
  2. Add `"stats"` to `READ_ONLY_ALLOWED` in `src/guards.ts` (it is a read operation)
  3. Implement `docker_stats` in `src/tools.ts` - accept `containerId`, return normalized object with CPU %, memory usage/limit, network rx/tx bytes
  4. Register the tool in `src/index.ts`
  5. Add to `openclaw.plugin.json` allowedOperations enum
  6. Add unit test with mocked stats response
  7. Add integration test against a running container
  8. Update README.md
- **Files:** `src/types.ts`, `src/guards.ts`, `src/tools.ts`, `src/index.ts`, `openclaw.plugin.json`, `test/tools.test.ts`, `test/integration/docker.test.ts`, `README.md`
- **Definition of Done:**
  - [ ] `docker_stats` tool returns CPU, memory, and network metrics
  - [ ] Allowed in readOnly mode
  - [ ] Unit and integration tests pass
  - [ ] README documents the tool

### T-008: Add project-level CLAUDE.md with dev conventions [low] (issue #4)
- **Goal:** Document project-specific development conventions for AI-assisted and human contributors
- **Context:** The workspace-level CLAUDE.md says "Each project may have its own CLAUDE.md with project-specific conventions. Always read the project-level CLAUDE.md before making changes." This project currently lacks one. Adding it captures the TypeScript patterns, test structure, and architecture decisions specific to openclaw-docker.
- **What to do:**
  1. Create `CLAUDE.md` in the project root
  2. Document: build/test commands, architecture layers (config -> client -> guards -> tools), how to add a new tool (checklist: types, guards, tools, index, tests, manifest, README), naming conventions (snake_case tool names, `docker_` prefix), test patterns (unit with mocks vs integration with real daemon)
  3. Reference the workspace-level CLAUDE.md for general conventions
- **Files:** `CLAUDE.md` (new)
- **Definition of Done:**
  - [ ] CLAUDE.md exists in project root
  - [ ] Contains build/test commands, architecture overview, and new-tool checklist
  - [ ] Does not duplicate workspace-level CLAUDE.md content

## 🚫 Blocked
(none)

## ✅ Recently Completed
  T-001: Add optional follow support for docker_logs (stream logs in real-time)
  T-004: Prepare first tagged release (review, changelog, tag)
  T-002: Add integration test profile against real Docker daemon in CI
  T-003: Add optional compose status tool (docker compose ps)

## ⚠️ Version Sync Rule
**ALWAYS keep `package.json` and `openclaw.plugin.json` versions in sync.**
When bumping a version, update BOTH files. Mismatched versions cause plugin loading failures and npm/ClawHub publish inconsistencies.

