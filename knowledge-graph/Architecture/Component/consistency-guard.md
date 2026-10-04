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

- Hooks: PostToolUse reports issues per write; Stop: summarization once, back to fix issues twice at most, a commit message
- Run end: one checked transaction; what it wrote lands unverified, with any definition whose files it changed; invalid → Harness/Issue, conflicts → Harness/Conflict, run's version landed; all to the timeline
- Main line: one pass at a time per workspace; entities over changed artifacts go artifact_ahead unless they changed too or the landing run summarized them
- Index: an unverified card gets its diff against its last verified; metrics; open issues are unverified ones
