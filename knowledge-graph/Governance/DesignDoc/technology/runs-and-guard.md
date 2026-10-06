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

- **Runs:** one Agent SDK subprocess per run in a detached worktree under `C:\Projects\.runs`, no branch; procgov job caps CPU and memory, killed with its tree
- **Instructions:** agent file plus summarization sub-agent
- **Summaries:** the Stop hook blocks once and hands the changed artifacts and graph-build documents to the sub-agent
- **Landing:** the checkout lands on the main line as one commit; a conflict takes the run's side and raises a Harness/Conflict; automation runs queue per project, user runs go at once
- **KB access:** MCP `momentum-kb`; `momentum-run` for graph build and interview
- **Guard:** PostToolUse validates each write, Stop sends the run back; one transaction per run
