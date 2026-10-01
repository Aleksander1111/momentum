---
type: Harness/Automation
origin: user
verification: unverified
sync: synced
product_impact: 0
timeline_impact: 0
unlocks: 0
references: []
artifacts:
  - automations/mapping/agents/momentum-mapping.md
---
# Mapping

Builds the knowledge graph of a workspace from its repository, run after run.

- Starts when the project is enabled; one run at a time on the mapping branch, each picking up the previous run's reported progress
- Goes top down, one layer per run: project, then parts, then Governance, then finer grain; types only from entity-types.tsv
- Never duplicates an entity; writes at most the feed's room, counting listed documents
- Lists repository documents for the Stop hook to summarize; never summarizes them itself
- Reports progress: documents, what's covered, what's next and coverage (0-1)
- Ends when a run reports the repository covered, or the user stops it
