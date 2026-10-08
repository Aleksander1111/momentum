---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 0
unlocks: 2
references:
  - to: Harness/Automation/summarization
    relation: hands_off_to
  - to: Harness/Automation/consistency-check
    relation: complements
artifacts:
  - apps/backend/src/guard.ts
  - apps/backend/src/hooks.ts
  - apps/backend/src/protocol.ts
  - apps/backend/src/metrics.ts
---
# Consistency guard

Lands each run's checked work; keeps the index true to main.

- Hooks: PostToolUse checks writes; SubagentStop: summarization ran; Stop: summarize once, ≤2 fixes, commit message
- Run end: one commit, all unverified, state moves on the timeline; invalid → Harness/Issue, conflict → Harness/Conflict, removed → Harness/Report
- Harness repo: lands only `HARNESS_SCOPE` and the graph; the rest put back
- Main line: one pass at a time; stops at a merge unless enabled; artifacts changed → artifact_ahead; moves followed
- Metrics per 24h/7d/30d: usage, attention, understanding, agents, runs, entity states, implementation, retrieval
- 10 approvals in a row on a type → Harness/Pattern proposal
