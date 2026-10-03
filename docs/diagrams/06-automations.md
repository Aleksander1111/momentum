# Automations

Source: [SPEC.md → Automations](../SPEC.md#automations)

```plantuml
left to right direction
rectangle "Knowledge base — every layer" as KB
rectangle "Goals" as Goals
rectangle "Attention feed" as Feed
rectangle "Repository artifacts\nchats, plans, results implemented by AI" as Artifacts
rectangle "Repository" as Repo
rectangle "Index and metrics database" as Metrics
rectangle "Definition entities, harness workspace\nartifacts: agents, skills, sub-agents, MCP" as HarnessRepo
rectangle "Trigger entities, per workspace" as Triggers
rectangle "Workspaces using a variant" as Workspaces
rectangle "User" as User
rectangle "Automations — per project, defined by responsibility alone" as Auto {
  rectangle "Exploration" as Exploration
  rectangle "Preparation" as Preparation
  rectangle "Consistency check" as Consistency
  rectangle "Retention" as Retention
  rectangle "Implementation" as Implementation
  rectangle "Validation" as Validation
  rectangle "Optimization" as Optimization
  rectangle "Summarization\nstep inside the other automations" as Summarization
  rectangle "Card\nstep inside the other automations" as Card
  rectangle "Chat" as Chat
  rectangle "Graph build\nstarted by enabling the project" as GraphBuild
}
Auto <--> KB : search and write in own checkout; everything lands on the main line
Goals --> Exploration : guide; all met → idle
Exploration --> Feed : next best action
Preparation --> Feed : plans as summaries
Consistency --> Feed : issue entities; knowledge graph only
Retention --> Feed : retirement proposals
KB --> Implementation : verified, entity_ahead
Implementation --> Validation : landed on the main line; target updating
Validation --> Feed : issue entities
Artifacts --> Summarization
Summarization --> KB : summaries
Card --> KB : cards within the character limit
Metrics --> Optimization
Optimization --> Feed : proposals to definitions and triggers
Feed --> HarnessRepo : approved
Feed --> Triggers : approved
HarnessRepo --> Workspaces : materialized on approval
User --> Chat : starts
Chat --> Feed : results
Repo --> GraphBuild : read run after run
GraphBuild --> Feed : entities, at most the feed's room
User ..> GraphBuild : watches usage, stops
```

## Step mechanism

```plantuml
left to right direction
rectangle "Step of a responsibility" as Step
hexagon "Expressible as a query or rule?" as Q
rectangle "Queries and rules\nindices, metrics, lifetimes, references" as Rules
rectangle "AI\ndeciding, planning, reviewing, summarizing" as AI
Step --> Q
Q --> Rules : yes
Q --> AI : no
```
