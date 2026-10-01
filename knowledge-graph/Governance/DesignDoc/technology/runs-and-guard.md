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

- **Runs:** Agent SDK subprocess per run in its own worktree `C:\Projects\.runs\<workspace>\<run-id>`, branch `momentum/<automation>/<run-id>`; procgov job caps CPU and memory, killed with its tree
- **Instructions:** the automation's agent file, summarization as a sub-agent
- **Summaries:** Stop hook blocks once and hands the run's changed artifacts and mapped documents, minus excluded paths, to the sub-agent
- **KB access:** MCP `momentum-kb`; `momentum-run` for validation and mapping
- **Guard:** PostToolUse validates each write, Stop sends the run back; chokidar watches outside edits; one transaction per run, index updated per transaction
