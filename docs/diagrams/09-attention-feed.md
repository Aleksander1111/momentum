# Attention feed

Source: [SPEC.md → Attention feed](../SPEC.md#attention-feed), [Index and metrics database](../SPEC.md#index-and-metrics-database)

```plantuml
rectangle "Enabled projects" as Enabled {
  rectangle "Entities, any type" as SA
  rectangle "Entities, any type" as SB
}
rectangle "Attention ranking — no project priority" as Ranking {
  rectangle "Impact on the product" as P
  rectangle "Impact on the timeline" as T
  rectangle "How much it unlocks" as U
}
rectangle "Index and metrics database\nranking computed as indices update" as Index
rectangle "API\nno work per poll" as API
rectangle "One feed across projects" as Feed
hexagon "User" as User
rectangle "Approved state\nverification: verified" as Main
rectangle "Change request, split,\nor new entities\nsync: updating" as Back
rectangle "Attention metrics\ntime per item, reactions" as AttM
rectangle "Patterns regular enough" as Patterns
rectangle "Automatic approval or rejection" as Auto
SA --> Ranking
SB --> Ranking
Ranking --> Index
Index --> API : feed order
API --> Feed
Feed --> User
User --> Main : verifies, approves
User --> Back : sends back
User --> AttM
AttM --> Patterns
Patterns --> Auto
```
