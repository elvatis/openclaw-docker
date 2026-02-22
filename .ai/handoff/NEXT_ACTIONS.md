# openclaw-docker — Next Actions

## P1 — Research (Sonar)
- [ ] Research: dockerode npm package (API, types, usage patterns)
- [ ] Research: Docker Compose v2 programmatic API (or CLI subprocess)
- [ ] Research: existing Docker + AI assistant integrations

## P2 — Architecture (Opus)
- [ ] Define config schema (socketPath, tls, readOnly, allowedOperations, composeProjects)
- [ ] Define agent tool signatures
- [ ] Decide: Docker Compose via CLI subprocess or compose-spec library

## P3 — Implementation (Sonnet)
- [ ] Create package.json + tsconfig.json + openclaw.plugin.json
- [ ] Implement Docker client wrapper (dockerode)
- [ ] Implement docker_list tool (with health status)
- [ ] Implement docker_logs tool (last N lines, follow option)
- [ ] Implement docker_inspect tool
- [ ] Implement docker_start / docker_stop / docker_restart (with allowedOperations guard)
- [ ] Implement docker_compose_up / docker_compose_down
- [ ] Write tests (mock Docker socket)

## P4 — Docs + Publish
- [ ] Update README.md with final setup guide
- [ ] npm publish @elvatis/openclaw-docker
- [ ] Blog article: "Managing Docker from your AI assistant with OpenClaw"
- [ ] Submit to OpenClaw community plugins page (PR)
