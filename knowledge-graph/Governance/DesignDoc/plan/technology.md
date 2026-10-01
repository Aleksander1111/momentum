---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 2
references:
  - to: Governance/DesignDoc/technology/runs-and-guard
    relation: details
  - to: Governance/DesignDoc/technology/data-and-ranking
    relation: details
  - to: Governance/DesignDoc/technology/client-and-access
    relation: details
  - to: Governance/DesignDoc/technology/machine-and-testing
    relation: details
artifacts:
  - docs/PLAN.md
---
# Technology decisions

The stack Momentum is built on, from the implementation plan.

| Area | Decision |
|---|---|
| Language | TypeScript, Node 24 LTS, pnpm workspaces monorepo |
| Front-end | Expo + Expo Router; web via react-native-web |
| Back-end | Fastify + zod, one process: API, orchestrator, guard |
| Runs | Claude Agent SDK, one subprocess per run |
| Store | Postgres 18 + pgvector, schema per workspace |

Driven by: Claude Code is Node, one language end to end, self-hosted.

Details: runs and guard, data and ranking, client and access, machine and testing.
