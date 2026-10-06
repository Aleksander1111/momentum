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
  - apps/backend/src/metrics.ts
---
# Consistency guard

Lands each run's checked changes; keeps the index true to main.

- Hooks: PostToolUse checks writes; SubagentStop: summarization ran; Stop: summarize once, ≤2 fixes, then a commit message
- Run end: one commit, all unverified; invalid → Harness/Issue, conflict → Harness/Conflict, removals → Harness/Report
- Harness repo: lands only `HARNESS_SCOPE` and the graph; the rest put back, in the issue
- Main line: one pass at a time; stops at a merge unless enabled; changed artifacts → artifact_ahead; moves followed
- Metrics per 24h/7d/30d: usage, attention, understanding, agents, run histograms, entity states, implementation
- 10 agreeing reactions on a type → Harness/Pattern proposal
