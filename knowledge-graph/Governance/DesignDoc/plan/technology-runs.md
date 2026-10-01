---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Governance/DesignDoc/plan/technology
    relation: part_of
artifacts:
  - docs/PLAN.md
---
# Technology: runs and guard

- **Runs:** Claude Agent SDK, one subprocess per run, cwd = its checkout
- **Isolation:** git worktree per run under `C:\Projects\.runs\<workspace>\<run-id>` on `momentum/<automation>/<run-id>`; procgov job object caps CPU and memory; killed with its process tree
- **KB access:** in-process MCP `momentum-kb` (search, read, references, write, record_agent_metric); `momentum-run` for validation
- **Guard:** PostToolUse validates each KB write, Stop sends the run back to fix rejects, chokidar watches `knowledge-graph/`; one run is one transaction, indexed once validated
- **Assumed, not verified:** procgov limits hold for the Claude Code process tree
