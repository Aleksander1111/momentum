---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 5
timeline_impact: 4
unlocks: 5
references:
  - to: Governance/DesignDoc/plan/work-packages
    relation: contains
artifacts:
  - docs/PLAN.md
---
# Momentum implementation plan

How Momentum is built from SPEC.md, in one pass ordered by dependency.

- TypeScript monorepo: Expo app, Fastify back-end, packages for contract, entity, kb, runs
- Knowledge graph as markdown entities, indexed in Postgres per workspace
- One Claude Code run per worktree and branch, checked by a consistency guard
- Ranked cross-project feed: swipe to approve or send back
- Models set once for all runs, per automation, or by implementation risk
- Self-hosted on this Windows 11 machine, reached over Tailscale

Open: tuning and measuring the attention ranking; scale, latency and usage targets.
