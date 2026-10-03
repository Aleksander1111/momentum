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

- **Queue**: automation serialized per workspace; user runs at once
- **Start**: checkout at the tip; guard, KB and run MCP, hooks
- **Model**: from settings, or by risk for an implementation
- **Context**: card parts ahead of the prompt: file > headings > quote or element
- **Stop hook**: changed artifacts, graph-build documents to summarization
- **Usage**: limit rises split among runs
- **Finish**: guard lands it; metrics, coverage
- **Restart**: lost runs resume twice at most; chats, interviews on the next message
- **Chat**: transcript `chats/<id>.jsonl`
- **Interview**: summary and commit message once done
