---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Harness/Automation/summarization
    relation: concerns
artifacts:
  - docs/PLAN.md
---
# Repository and entities

| Path | Holds |
|---|---|
| apps/ | Expo app; Fastify API, orchestrator, guard |
| packages/ | contract, entity, kb, runs |
| automations/<name>/ | Claude Code files of each definition entity |
| knowledge-graph/ | The harness's own knowledge base |

- Definitions materialize into `<workspace>\.claude\` on approval, excluded from git
- Every run's Stop hook hands its changed artifacts to the summarization sub-agent
- Entity: frontmatter (type, origin, verification, sync, 0–5 ranks, references, artifacts) + card
- Validator: card within the limit, type matches the directory, references resolve
