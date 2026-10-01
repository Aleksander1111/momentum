---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 4
unlocks: 4
references:
  - to: Harness/Automation/summarization
    relation: concerns
  - to: Harness/Automation/graph-build
    relation: concerns
  - to: Harness/Automation/implementation
    relation: concerns
artifacts:
  - docs/PLAN.md
---
# Momentum implementation plan

The harness built in one pass: 12 work packages (machine to end-to-end validation) ordered by dependency.

| Area | Choice |
|---|---|
| Stack | TypeScript, Node 24, pnpm monorepo |
| App | Expo web + mobile, polling |
| Back-end | Fastify: API, orchestrator, guard, MCP |
| Runs | Agent SDK, worktree + branch, procgov limits |
| Store | Postgres 18 + pgvector per workspace |

- Guard hooks validate each KB write; Stop hook hands artifacts to summarization
- Approve commits the entity to main; send back starts a chat run
- Graph build covers the repo on enable
- Models: one for all, per automation, or by risk
- Open: ranking tuning; scale, latency, usage targets
