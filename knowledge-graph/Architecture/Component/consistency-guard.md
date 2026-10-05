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

Validates each run's knowledge-base changes; keeps the index true to the main line.

- Hooks: PostToolUse reports issues per write; Stop: summarization once, fixes twice at most, a commit message
- Run end: one checked transaction, landed unverified; invalid → Harness/Issue, conflicts → Harness/Conflict
- Main line: one pass at a time; halts at a merge commit unless enabled; entities over changed artifacts go artifact_ahead unless changed or summarized by the landing run; moves followed, into exclusions = deleted
- Index: card diff against last verified; implemented directly or via a plan; metrics
- Ten agreeing reactions on a type commit a Harness/Pattern proposal; it counts once approved
