---
type: Architecture/Dependency
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 4
references: []
artifacts:
  - packages/contract/src/index.ts
  - packages/contract/openapi.json
  - packages/contract/package.json
---
# @momentum/contract

Internal library: zod schemas and inferred types shared by the app and backend, plus the generated `openapi.json` (Momentum API, OpenAPI 3.0.3) served at `/openapi.json`.

| Area | Schemas |
|---|---|
| Entity | Verification, Sync, Origin, Impact, EntityFrontmatter, TriggerFields |
| Card | Inline, Block (markdown AST; mermaid as SVG) |
| Feed | FeedItem, FeedCounts by state, Approve, SendBack |
| Runs & chats | AutomationName, RunStatus, Usage (5h/weekly %), RunDetail |
| Mapping & metrics | MappingStatus, MetricsResponse |
| Settings | LifetimeRule, ModelMode (single / per automation / risk), ModelChoice |
| Session | SessionRequest/Response, Workspace |
