# Layers

Source: [SPEC.md → Dictionary: Layers](../SPEC.md#dictionary), [Components](../SPEC.md#components)

```plantuml
rectangle "User" as User
rectangle "Attention layer — shared across projects" as Attention {
  rectangle "Ranked feed" as Feed
  rectangle "Approval" as Approval
}
rectangle "Once per project" as PerProject {
  rectangle "Understanding layer" as Understanding {
    rectangle "Entities" as Entities
    rectangle "Index" as Index
  }
  rectangle "Implementation layer" as Implementation {
    rectangle "Automations" as Automations
    rectangle "Runs" as Runs
    rectangle "Validation" as Validation
  }
}
User --> Feed : verifies, approves, sends back
Feed --> Approval
Entities --> Feed : feed items
Index --> Feed : attention ranking
Entities --> Index : consistency guard updates
Automations --> Runs : one process per run
Runs --> Entities : read and write in own checkout; land on the main line
Runs --> Validation : implementation change triggers
```
