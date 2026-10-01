---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 4
unlocks: 3
references: []
artifacts:
  - docs/PLAN.md
---
# Technology decisions

| Area | Choice |
|---|---|
| Stack | TypeScript, Node 24, pnpm monorepo |
| App | Expo + react-native-web; TanStack Query polling |
| Back-end | Fastify + zod: API, orchestrator, guard |
| Runs | Agent SDK per run, own worktree, procgov job |
| Index | Postgres 18 + pgvector, schema per workspace; `harness` schema for settings |
| KB access | `momentum-kb`, `momentum-run` MCP |
| Guard | Claude Code hooks + chokidar; mermaid to SVG via Playwright |
| Access | Password over Tailscale; API is also MCP |
| Host | Windows 11, WinSW; APK and iPhone PWA |
| Tests | Vitest, Playwright |

Unverified: procgov limits hold for the Claude Code tree.
