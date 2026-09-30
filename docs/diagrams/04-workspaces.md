# Workspaces and projects

Source: [SPEC.md → Workspaces and projects](../SPEC.md#workspaces-and-projects), [Automations → Optimization](../SPEC.md#automations)

```mermaid
flowchart TB
  Orch["Orchestrator"]
  ChatTool["Chat tool"]
  DirectEdit["Direct entity edit"]
  Proposal["Automation proposal<br/>approved by the user"]
  subgraph Root["Root directory on the dedicated machine"]
    subgraph Harness["Harness repository — a workspace"]
      subgraph HKB["Knowledge base"]
        HGoals["Goals"]
        HDefs["Definition entities<br/>one per automation"]
      end
      HArt["automations/<br/>agent, skill, sub-agent and MCP files<br/>artifacts of the definitions"]
    end
    subgraph WA["Workspace A — enabled"]
      subgraph AKB["Knowledge base"]
        AGoals["Goals"]
        ATrig["Trigger entities"]
      end
      AVariants["Materialized variants"]
    end
    subgraph WB["Workspace B — disabled"]
      subgraph BKB["Knowledge base"]
        BGoals["Goals"]
        BTrig["Trigger entities"]
      end
    end
  end
  ATrig -->|"read by"| Orch
  Orch -->|"schedules loops<br/>5 to 20 enabled projects expected"| WA
  Orch -. "no loops" .-> WB
  ChatTool --> AGoals
  DirectEdit --> AGoals
  Proposal --> AGoals
  HDefs --- HArt
  HArt -->|"materialized on approval<br/>into the workspaces that use them"| AVariants
  AKB x--x|"isolated: no entities, findings or knowledge cross"| BKB
```
