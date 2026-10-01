---
type: Product/Product
origin: automation
verification: unverified
sync: synced
product_impact: 5
timeline_impact: 3
unlocks: 5
references: []
artifacts:
  - docs/SPEC.md
---
# Momentum

A self-hosted harness. It is the single entry point between one user and the work around 5–20 projects, which the user explores as entity cards instead of raw artifacts.

| Layer | What it does |
|---|---|
| Attention | One ranked feed across projects. Nothing counts until approved |
| Understanding | A Graph RAG knowledge base per workspace. A guard validates every change |
| Implementation | Claude Code loops, one process and branch per run, paused at the feed limit |

Enabling a project builds its graph. A Stop hook summarizes every run's artifacts. Success means consistency grows and work arrives in one piece.
