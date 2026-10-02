---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Governance/DesignDoc/plan
    relation: part_of
  - to: Governance/DesignDoc/plan/technology-runs
    relation: continues_in
  - to: Governance/DesignDoc/plan/technology-data
    relation: continues_in
  - to: Governance/DesignDoc/plan/technology-platform
    relation: continues_in
artifacts:
  - docs/PLAN.md
---
# Technology decisions

TypeScript throughout: Node 24 LTS, pnpm workspaces monorepo, matching Claude Code and the Agent SDK.

| Area | Decision |
|---|---|
| Front-end | Expo + Expo Router; web via react-native-web, served by the back-end |
| Gestures | gesture-handler + reanimated: swipe right approves, left disapproves with a comment |
| Polling | TanStack Query `refetchInterval`, no sockets |
| Cards | Markdown AST; mermaid rendered to SVG on the server by the guard, no WebView |
| Back-end | Fastify + zod, one process: API, orchestrator, guard |

Runs, data and platform decisions continue in the sibling cards. Assumed, not verified: procgov limits hold for the Claude Code subprocess tree.
