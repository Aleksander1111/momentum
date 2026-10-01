---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 4
unlocks: 3
references:
  - to: Governance/DesignDoc/plan
    relation: part_of
artifacts:
  - docs/PLAN.md
---
# Technology decisions

| Area | Choice |
|---|---|
| Language | TypeScript, Node 24, pnpm monorepo |
| App | Expo + Expo Router, web via react-native-web; polling with TanStack Query |
| Back-end | Fastify + zod: API, orchestrator and guard in one process |
| Runs | Agent SDK subprocess per run in its own git worktree and procgov job object |
| Index | Postgres 18 + pgvector in Docker, schema per workspace; bge-small embeddings |
| KB access | `momentum-kb` and `momentum-run` MCP servers |
| Guard | Claude Code hooks + chokidar; one transaction per run |
| Access | Password session over Tailscale only; API doubles as MCP |
| Machine | Windows 11, WinSW service; Android APK, iPhone PWA |
