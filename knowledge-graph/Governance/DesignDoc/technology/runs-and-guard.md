---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 2
references:
  - to: Governance/DesignDoc/plan/technology
    relation: part_of
  - to: Harness/Automation/validation
    relation: concerns
artifacts:
  - docs/PLAN.md
---
# Runs and consistency guard

- **Runs:** Claude Agent SDK subprocess per run, cwd = its own git worktree under `C:\Projects\.runs\<workspace>\<run-id>`, branch `momentum/<automation>/<run-id>`
- **Limits:** procgov job object with CPU and memory caps; killed with its process tree
- **KB access:** in-process MCP `momentum-kb` (search, read, references, write, record_agent_metric); `momentum-run` for validation
- **KB files:** markdown per type path, frontmatter + card; unified/remark parser checks the limit and references
- **Guard:** PostToolUse hook validates each write, Stop hook sends the run back; chokidar watches outside edits; one transaction per run, index updated per transaction
