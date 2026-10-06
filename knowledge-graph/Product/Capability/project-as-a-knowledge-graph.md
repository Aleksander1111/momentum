---
type: Product/Capability
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 1
unlocks: 4
references:
  - to: Product/Product/momentum
    relation: part_of
  - to: Product/Goal/consistency-grows
    relation: realises
  - to: Architecture/Component/knowledge-base
    relation: realised_by
  - to: Architecture/Component/consistency-guard
    relation: realised_by
  - to: Harness/Automation/graph-build
    relation: realised_by
  - to: Harness/Automation/summarization
    relation: realised_by
  - to: Harness/Automation/search
    relation: realised_by
  - to: Harness/Automation/consistency-check
    relation: realised_by
  - to: Frontend/Screen/explorer
    relation: shown_on
artifacts: []
---
# A project understood as a knowledge graph

Every enabled project is explored through entity cards instead of its files.

- **Graph build** reads the repository top down, run after run, until the harness measures nothing missing
- **Summarization** turns every run's artifacts into entities from its Stop hook, and the user's own commits in a run the main-line index starts
- **Entities** are markdown by type, referenced to each other, each claiming the artifacts it accounts for
- **Explorer** browses by domain and type; **search** answers a question from the entities it finds
- **Guard** validates every change before it lands; the **consistency check** raises contradictions as issues to resolve
