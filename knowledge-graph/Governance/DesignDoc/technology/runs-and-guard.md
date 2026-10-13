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
  - to: Harness/Automation/graph-build
    relation: concerns
artifacts: []
---
# Runs and consistency guard

- **Runs:** one Agent SDK subprocess per run in the project folder, on main, no worktree or branch; procgov job caps CPU and memory, killed with its tree
- **Instructions:** agent file plus summarization sub-agent
- **Summaries:** the Stop hook blocks once and hands the changed artifacts and graph-build documents to the sub-agent
- **Landing:** what the run left is one commit on main, on top of the user's; one run per project at a time, user runs first
- **KB access:** MCP `momentum-kb`; `momentum-run` for graph build and interview
- **Guard:** PostToolUse validates each write, Stop sends the run back; one transaction per run
