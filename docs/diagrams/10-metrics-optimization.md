# Metrics and optimization

Source: [SPEC.md → Index and metrics database](../SPEC.md#index-and-metrics-database), [Automations: Optimization](../SPEC.md#automations)

```plantuml
left to right direction
rectangle "Consistency guard" as Guard
rectangle "Index and metrics database — per workspace, tracked over time" as DB {
  rectangle "Attention\ntime per item, approved, rejected, sent back, patterns" as Att
  rectangle "Understanding\nknowledge base consistency" as Und
  rectangle "Agents\nmisalignments in chats, recurring issues, run over run" as Ag
  rectangle "Implementation\noutstanding issues, bugs, defects" as Imp
  rectangle "Usage\npercentage points of the rolling 5-hour and weekly limits" as Usage
}
rectangle "Optimization automation" as Opt
rectangle "Chats" as Chats
rectangle "Resolutions\nskills, sub-agents, definitions, tools, MCP servers" as Res
rectangle "Competing variants compared on metrics" as Compare
Guard --> DB : every validated transaction
DB --> Opt
Chats --> Opt : misalignments, recurring issues
Opt --> Res
Opt --> Compare
```
