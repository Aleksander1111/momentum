---
type: Architecture/Component
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 3
references:
  - to: Harness/Automation/interview
    relation: concerns
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

- **Start**: checkout at the tip; guard, KB and run MCP, hooks; automation runs one per workspace
- **Model**: from settings, or by risk for an implementation
- **Context**: card selections; optimization also gets the enabled projects
- **Messages**: in order; one to a starting run waits for it, to a queued run joins its prompt
- **Stop hook**: changed artifacts, graph-build documents to summarization
- **Usage**: split among runs
- **Finish**: guard lands it; metrics, coverage
- **Restart**: lost runs resume twice at most
- **Chat**: transcript `chats/<id>.jsonl`; **interview**: summary and commit message once done
