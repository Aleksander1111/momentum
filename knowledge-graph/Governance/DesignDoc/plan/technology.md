---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 3
unlocks: 4
references:
  - to: Governance/DesignDoc/plan
    relation: part_of
artifacts:
  - docs/PLAN.md
---
# Plan: technology

| Area | Choice |
|---|---|
| App | Expo + react-native-web, TanStack Query polling |
| Back-end | Fastify + zod: API, orchestrator, guard |
| Runs | Agent SDK, git worktree, procgov job object |
| Index | Postgres 18 + pgvector, schema per workspace |
| Retrieval | Full text + cosine + reference traversal |
| KB tools | `momentum-kb` and `momentum-run` MCP |
| Guard | Hooks + file watcher, transaction per run |
| Rank | product + timeline + unlocks (0–5 each) |
| Access | Password session, Tailscale only |
| Mobile | Sideloaded APK; PWA on iPhone |

Assumed: procgov limits hold for the Claude Code process tree.
