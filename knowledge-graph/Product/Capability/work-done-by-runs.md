---
type: Product/Capability
origin: automation
verification: unverified
sync: synced
product_impact: 5
timeline_impact: 2
unlocks: 4
references:
  - to: Product/Product/momentum
    relation: part_of
  - to: Product/Goal/work-arrives-whole
    relation: realises
  - to: Product/Goal/flexible-without-constant-modification
    relation: realises
  - to: Architecture/Component/orchestrator
    relation: realised_by
  - to: Architecture/Component/runner
    relation: realised_by
  - to: Harness/Automation/preparation
    relation: realised_by
  - to: Harness/Automation/implementation
    relation: realised_by
  - to: Harness/Automation/validation
    relation: realised_by
  - to: Harness/Automation/exploration
    relation: realised_by
  - to: Harness/Automation/interview
    relation: realised_by
  - to: Harness/Automation/optimization
    relation: realised_by
artifacts: []
---
# Work done by Claude Code runs

Each run works in its own checkout of the main line and lands as one commit when it ends.

- **Preparation** writes plans for tasks, issues and research; an approved entity with nothing implementing it starts **implementation**
- **Validation** checks what landed, and the project as it stands in the background; failures and conflicts reach the feed
- **Exploration** picks the next best action within the goals; **interview** writes a document one question at a time
- **Optimization** proposes skills, memories and definition changes from patterns seen three times
- Automation runs go one at a time per project, queued only while the feed has room
