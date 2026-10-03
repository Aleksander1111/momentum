# Workspaces and projects

Source: [SPEC.md → Workspaces and projects](../SPEC.md#workspaces-and-projects), [Automations → Optimization](../SPEC.md#automations)

```plantuml
rectangle "Orchestrator" as Orch
rectangle "Chat tool" as ChatTool
rectangle "Direct entity edit" as DirectEdit
rectangle "Automation proposal\napproved by the user" as Proposal
rectangle "Root directory on the dedicated machine" as Root {
  rectangle "Harness repository — a workspace" as Harness {
    rectangle "Knowledge base" as HKB {
      rectangle "Goals" as HGoals
      rectangle "Definition entities\none per automation" as HDefs
    }
    rectangle "automations/\nagent, skill, sub-agent and MCP files\nartifacts of the definitions" as HArt
  }
  rectangle "Workspace A — enabled" as WA {
    rectangle "Knowledge base" as AKB {
      rectangle "Goals" as AGoals
      rectangle "Trigger entities" as ATrig
    }
    rectangle "Materialized variants" as AVariants
  }
  rectangle "Workspace B — disabled" as WB {
    rectangle "Knowledge base" as BKB {
      rectangle "Goals" as BGoals
      rectangle "Trigger entities" as BTrig
    }
  }
}
ATrig --> Orch : read by
Orch --> WA : schedules loops\n5 to 20 enabled projects expected
Orch ..> WB : no loops
ChatTool --> AGoals
DirectEdit --> AGoals
Proposal --> AGoals
HDefs -- HArt
HArt --> AVariants : materialized on approval\ninto the workspaces that use them
AKB x--x BKB : isolated: no entities, findings or knowledge cross
```
