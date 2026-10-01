---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references: []
artifacts:
  - docs/PLAN.md
kind: design doc
---
# Momentum implementation plan

Turns the spec into a single-pass build: technology choices, repository layout, entity format, twelve work packages, approval and send-back, seven pages with their API, database additions.

- TypeScript monorepo; Expo app for web and mobile, light and dark palettes
- Fastify back-end: API, orchestrator and guard in one process
- Agent SDK runs in git worktrees under job-object limits
- Postgres 18 + pgvector, a schema per workspace plus harness
- Guard as hooks plus watcher; rank = the three parameters summed
- Feed counters by verification and sync state
- Mapping build: stop, resume, two-tap reset

Open: ranking tuning, scale, latency and usage targets. Assumed: procgov limits hold.
