---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 3
references:
  - to: Harness/Automation/summarization
    relation: concerns
  - to: Harness/Automation/validation
    relation: concerns
  - to: Harness/Automation/graph-build
    relation: concerns
  - to: Harness/Automation/implementation
    relation: concerns
  - to: Harness/Automation/chat
    relation: concerns
artifacts:
  - apps/backend/src/runner.ts
---
# Runner

One Claude Code session per run, in a detached checkout of the main line.

- **Queue**: automation runs one at a time per workspace; user runs at once
- **Start**: checkout at the tip, guard watching; KB and run MCP, hooks, limits; KB rules in the prompt (PlantUML, no mermaid)
- **Model**: from settings; an implementation's by estimated risk
- **Stop hook**: changed artifacts and graph-build documents to summarization
- **Usage**: each rise of the shared limits split among concurrent runs
- **Finish**: guard transaction lands it; status, metrics, coverage
- **Restart**: a lost run requeues and resumes, twice at most
- **Chat**: resumes on a fresh checkout; transcript `chats/<id>.jsonl`
