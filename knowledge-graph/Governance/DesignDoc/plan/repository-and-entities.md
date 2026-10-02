---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Governance/DesignDoc/plan
    relation: part_of
  - to: Harness/Automation/summarization
    relation: concerns
  - to: Harness/Automation/graph-build
    relation: concerns
artifacts:
  - docs/PLAN.md
---
# Repository and entities

| Path | Holds |
|---|---|
| apps/ | Expo app; Fastify API, orchestrator, guard |
| packages/ | contract, entity, kb, runs |
| automations/<name>/ | Claude Code files of a definition; trigger.md its default trigger |
| knowledge-graph/ | harness knowledge base |

- Definitions materialize into `<workspace>\.claude\` on approval
- Stop hook hands changed artifacts and graph-build documents to the summarization sub-agent
- Entity: frontmatter + card; extra fields on Trigger, Issue (severity, options, recommended, wont_resolve), Conflict, Automation
- Relations acted on: implements, retires, concerns
- Validator: card limit, type fits path, references resolve
