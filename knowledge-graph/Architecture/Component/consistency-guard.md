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

Lands each run's checked changes; keeps the index true to the main line.

- Hooks: PostToolUse checks writes; SubagentStop: summarization ran; Stop: summarize once, ≤2 fixes, message
- Run end: one checked commit; invalid → Harness/Issue, conflict → Harness/Conflict
- Handed artifacts its step never saw nor its entities cover: summarized after landing
- Harness repo: lands only `HARNESS_SCOPE` and the graph; the rest put back, in an issue
- Main line: one pass at a time; stops at a merge unless enabled; changed artifacts → artifact_ahead; moves followed
- Index: diff since verified; implemented directly or via plan; metrics
- 10 agreeing reactions on a type → Harness/Pattern proposal
