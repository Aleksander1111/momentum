---
type: Product/Product
origin: automation
verification: unverified
sync: synced
product_impact: 5
timeline_impact: 3
unlocks: 5
references: []
artifacts: []
---
# Momentum

A self-hosted harness: the single entry point between one user and the work around 5–20 isolated projects, explored as entity cards instead of raw artifacts.

| Layer | What it does |
|---|---|
| Attention | One feed across projects, ranked by product, timeline and unlock impact. Only approved work counts |
| Understanding | A Graph RAG knowledge base per workspace. A guard validates every change |
| Implementation | Claude Code runs, one process and detached checkout each, landed on the main line; automation runs queued per project, paused at the feed limit |

Enabling a project starts its graph build. A Stop hook summarizes every run's artifacts. Usage: % of the 5-hour and weekly limits.
