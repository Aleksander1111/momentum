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
| automations/<name>/ | Claude Code files of a definition; trigger.md is its default trigger |
| knowledge-graph/ | The harness's own knowledge base |

- Definitions materialize into `<workspace>\.claude\` on approval, excluded from git
- Stop hook blocks once, hands changed artifacts, transcripts and graph build documents (minus excluded paths) to summarization: a hook, not a trigger
- Entity: frontmatter + card; extra fields on Trigger, Issue, Automation
- Acted-on relations: implements, retires, concerns
- Validator: card limit, type fits path, references resolve
