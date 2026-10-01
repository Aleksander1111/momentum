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

One-pass build of the spec: technology, layout, entity format, twelve work packages, approval, seven pages, database additions.

- TypeScript monorepo; Expo app for web and mobile, light and dark
- Fastify back-end: API, orchestrator, guard; Agent SDK runs in worktrees, job-object limits
- Postgres 18 + pgvector, a schema per workspace plus harness
- Guard as hooks plus watcher; rank = the three parameters summed
- Approval and send-back over two states: verification and sync
- Mapping build: coverage, time spent, full-build estimate; stop, resume, two-tap reset
- Per-run usage as 5-hour and weekly share

Open: ranking tuning, scale, latency, usage targets. Assumed: procgov limits hold.
