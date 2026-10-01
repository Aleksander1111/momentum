---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 2
references:
  - to: Harness/Automation/summarization
    relation: concerns
  - to: Harness/Automation/validation
    relation: concerns
artifacts:
  - docs/PLAN.md
---
# Runs and consistency guard

- **Runs:** Agent SDK subprocess per run, cwd = own worktree `C:\Projects\.runs\<workspace>\<run-id>`, branch `momentum/<automation>/<run-id>`; procgov job caps CPU and memory, killed with its tree
- **Instructions:** the automation's agent file, no sub-agents
- **After a run:** harness queues summarization on the same branch for changed artifacts outside `knowledge-graph/` and mapped documents, minus excluded paths; runs on one branch go one after another
- **KB access:** MCP `momentum-kb`; `momentum-run` for validation and mapping
- **Guard:** PostToolUse validates each write, Stop sends the run back; chokidar watches outside edits; one transaction per run, index updated per transaction
