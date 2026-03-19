# CLAUDE.md - openclaw-docker

Developer guide for AI coding agents (Claude Code, Codex, etc.) working on this repo.

## Quick commands

```bash
# Install dependencies
npm install

# Build (TypeScript -> dist/)
npm run build

# Run unit tests (vitest, no Docker required)
npm test

# Run integration tests (requires a live Docker socket)
npm run test:integration

# Run everything
npm run test:all

# Watch mode
npm run test:watch

# Type-check without emitting
npx tsc --noEmit
```

CI runs on every push via `.github/workflows/ci.yml` (type check + unit tests).
Integration tests are opt-in and require Docker.

---

## Architecture overview

```
src/
  index.ts          Plugin entry point. Receives OpenClaw API, registers all tools.
  config.ts         normalizeConfig() - validates and normalises raw plugin config.
  dockerClient.ts   createDockerClient() - builds a Dockerode instance from config.
  tools.ts          createTools() - all tool implementations (docker_ps, docker_logs, etc.)
  compose.ts        runComposeCommand() - shells out to docker compose CLI.
  guards.ts         assertOperationAllowed() - enforces readOnly / allowedOperations.
  types.ts          Shared TypeScript types (PluginConfig, DockerOperation, etc.)
  templates/        Agent-facing helper templates (e.g. github-issue-helper.ts)

test/
  tools.test.ts           Unit tests for createTools() with mocked Dockerode.
  integration/
    docker.test.ts        Integration tests against a real Docker socket.
```

### Data flow

```
OpenClaw runtime
  -> init(api)              (src/index.ts)
  -> normalizeConfig()      (src/config.ts)   validates plugin config
  -> createDockerClient()   (src/dockerClient.ts)
  -> createTools({ docker, config })
  -> api.registerTool(name, handler)   for each tool
```

### Guards / safety model

`guards.ts` is the single enforcement point. Every tool calls `guard(op, config)` before doing anything. If `config.readOnly` is `true`, only `ps`, `logs`, and `inspect` are allowed. If `config.allowedOperations` is set, only those ops pass.

### Compose projects

Named compose stacks are declared in `config.composeProjects` as `{ name, path }` pairs. `tools.ts` resolves project names to filesystem paths via `resolveProjectPath()` and delegates to the `docker compose` CLI via `compose.ts`.

---

## How to add a new tool

1. **Add the operation name** to `DockerOperation` in `src/types.ts`.

2. **Add the guard** - in `src/guards.ts`, include the new op name in the `WRITE_OPS` or appropriate set if it should be blocked in read-only mode.

3. **Implement the handler** in `src/tools.ts`:
   - Add the method signature to `ToolMap`.
   - Add the implementation inside `createTools()`.
   - Always call `guard("your_op", config)` at the top.
   - Wrap Dockerode calls in try/catch and re-throw with descriptive messages.

4. **Register the tool** in `src/index.ts`:
   ```ts
   register("docker_your_tool", async (input) =>
     tools.docker_your_tool(input as { /* typed input */ })
   );
   ```

5. **Add unit tests** in `test/tools.test.ts`:
   - Mock Dockerode using `vi.fn()`.
   - Test happy path + error handling + guard rejection.

6. **Document** the new tool in `README.md` (Options table and usage example).

### Checklist

- [ ] `DockerOperation` union updated in `types.ts`
- [ ] Guard logic updated in `guards.ts`
- [ ] Handler added to `ToolMap` and `createTools()` in `tools.ts`
- [ ] Tool registered in `index.ts`
- [ ] Unit tests added/updated
- [ ] README.md updated

---

## Config reference

Key fields in `PluginConfig` (see `src/types.ts` and `src/config.ts`):

| Field | Type | Default | Notes |
|---|---|---|---|
| `socketPath` | string | `/var/run/docker.sock` | Unix socket path |
| `host` | string | - | TCP host (remote Docker) |
| `port` | number | - | TCP port |
| `readOnly` | boolean | `false` | Only allows ps/logs/inspect |
| `allowedOperations` | string[] | - | Fine-grained op whitelist |
| `composeProjects` | `{name,path}[]` | `[]` | Named compose stacks |
| `timeoutMs` | number | `15000` | Dockerode timeout |
| `tls` | object | - | TLS cert paths for remote |

---

## Conventions

- No em dashes in code, comments, or docs. Use commas, colons, or parentheses instead.
- All public functions and types must have JSDoc comments.
- Errors must surface with actionable messages (include operation + container ID where relevant).
- Do not add runtime dependencies without a good reason. Dockerode is the only allowed one.
