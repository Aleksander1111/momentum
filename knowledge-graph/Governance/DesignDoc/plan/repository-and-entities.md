---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 3
unlocks: 3
references:
  - to: Governance/DesignDoc/plan
    relation: part_of
artifacts:
  - docs/PLAN.md
---
# Repository layout and entity format

- `apps/`: Expo app; back-end (API, orchestrator, guard, MCP)
- `packages/`: contract, entity (parser, validator, mermaid), kb (index, retrieval), runs (SDK, worktrees, job objects)
- `automations/<name>/`: Claude Code files of each definition entity, materialized under `<workspace>\.claude\` on approval
- Entity: frontmatter (type, origin, verification, sync, three 0–5 ranks, references, artifacts) plus a card within the character limit
- Validator: card limit, type path matches the directory, every reference resolves on the branch
- After every run the harness queues a summarization run on its branch for changed artifacts
