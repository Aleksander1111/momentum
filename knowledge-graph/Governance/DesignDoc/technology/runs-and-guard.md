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
  - to: Harness/Automation/graph-build
    relation: concerns
artifacts:
  - docs/PLAN.md
---
# Runs and consistency guard

- **Runs:** one Agent SDK subprocess per run in its worktree `C:\Projects\.runs\<workspace>\<run-id>`, branch `momentum/<automation>/<run-id>`; procgov job caps CPU and memory, killed with its tree
- **Instructions:** the automation's agent file, summarization as a sub-agent
- **Summaries:** when a run stops by itself, its Stop hook blocks once and hands the changed artifacts and graph-build documents, minus excluded paths, to the sub-agent
- **KB access:** MCP `momentum-kb`; `momentum-run` for validation and graph build
- **Guard:** PostToolUse validates each write, Stop sends the run back; chokidar watches outside edits; one transaction per run, index updated per transaction
