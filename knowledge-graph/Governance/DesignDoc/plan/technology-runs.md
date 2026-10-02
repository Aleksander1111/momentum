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

- **Runs:** Agent SDK, one subprocess per run, cwd = its checkout
- **Isolation:** detached worktree per run under `C:\Projects\.runs\<workspace>\<run-id>`, no branch; procgov job caps CPU and memory; killed with its tree
- **Landing:** the checkout lands on the main line as one commit, fast-forwarded or replayed; a conflicting file takes the run's side and raises a Harness/Conflict
- **Scheduling:** automation runs one at a time per project; user runs at once
- **KB access:** MCP `momentum-kb`; `momentum-run` for the graph build
- **Guard:** PostToolUse validates each write, Stop sends the run back; chokidar watches `knowledge-graph/`; one transaction per run
