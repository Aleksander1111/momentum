---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Architecture/System/momentum-harness
    relation: documents
  - to: Governance/DesignDoc/spec
    relation: realises
  - to: Code/Repository/momentum
    relation: documents
  - to: Data/Database/index-and-metrics-database
    relation: documents
artifacts:
  - docs/PLAN.md
kind: design doc
---
# Momentum implementation plan

Turns the spec into a single-pass build: technology decisions, repository layout, entity file format, twelve work packages, approval and send-back flow, seven pages with their API, database additions.

Settles:
- TypeScript monorepo; Expo app; Fastify back-end with API, orchestrator and guard in one process
- Agent SDK runs in git worktrees under job-object limits
- Postgres 18 with pgvector, one schema per workspace plus a harness schema
- Guard as Claude Code hooks and a watcher; rank = the three parameters summed
- Spec's open questions decided; default triggers and mapping rules set

Open: ranking tuning and measurement; scale, latency and usage targets. Assumed: procgov limits hold.
