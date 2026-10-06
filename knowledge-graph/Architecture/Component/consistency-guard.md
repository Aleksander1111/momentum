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

- Hooks: PostToolUse flags writes; Stop: summarization once, ≤2 fixes, a commit message
- Run end: one checked commit, unverified; invalid → Harness/Issue, conflict → Harness/Conflict
- Harness repo: a run lands only its automation's `HARNESS_SCOPE` and the graph; the rest is put back, named in the issue
- Main line: one pass at a time; stops at a merge unless enabled; changed artifacts make entities artifact_ahead unless the run covered them; moves followed, into exclusions = deleted
- Index: diff since verified; implemented directly or via a plan; metrics
- Ten agreeing reactions on a type: a Harness/Pattern proposal
