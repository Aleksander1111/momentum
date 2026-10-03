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
  - to: Governance/DesignDoc/plan/approval
    relation: contains
  - to: Governance/DesignDoc/plan/technology
    relation: contains
artifacts: []
---
# Momentum implementation plan

How Momentum is built, in one pass ordered by dependency.

- TypeScript monorepo: Expo app, Fastify back-end, packages for contract, entity, kb, runs
- Knowledge graph as markdown entities on the main line, indexed in Postgres per workspace
- One Claude Code run per detached worktree, landed on the main line as one commit; automation runs queued per project, user runs at once
- Ranked cross-project feed: swipe to approve, send back or resolve an issue
- Models for all runs, per automation, or by implementation risk
- Self-hosted on this Windows 11 machine, over Tailscale

Open: tuning the attention ranking; scale, latency and usage targets.
