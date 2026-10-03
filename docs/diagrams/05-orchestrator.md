# Orchestrator and runs

Source: [SPEC.md → Orchestrator](../SPEC.md#orchestrator), [Automations → Chat](../SPEC.md#automations)

```plantuml
rectangle "Trigger entities, per workspace\nschedule, event, on demand" as Trig
rectangle "Chat, send back, automation on demand\nstarted by the user" as Demand
rectangle "Project enabled by the user" as Enable
rectangle "One back-end deployable" as Backend {
  rectangle "API" as API
  rectangle "Orchestrator" as Orch
}
hexagon "Project enabled?" as Enabled
rectangle "No loops" as NoLoops
rectangle "Automation runs, per project\nqueued, one at a time" as Queue
rectangle "Graph build: knowledge graph built from the repository\nrun after run until covered or stopped" as GraphBuild
rectangle "Run processes — isolated, killable, own resource limits" as Procs {
  rectangle "Automation run\nClaude Code process\nown checkout of the main line" as R1
  rectangle "User-started run\nClaude Code process\nown checkout of the main line" as R2
}
rectangle "Main line — the one branch\nevery run lands on it when it ends" as Main
rectangle "Attention feed" as Feed
rectangle "Anthropic API limits" as Limits
rectangle "User" as User
Trig --> Orch
Demand --> Orch
Enable --> Orch
Orch --> Enabled
Enabled --> NoLoops : no
Enabled --> Queue : yes
Enabled --> GraphBuild : yes, until covered
Queue --> R1 : one automation run per project
GraphBuild --> R1 : one run at a time\nat most the feed's room
Demand --> R2 : at once, alongside
R1 --> Main
R2 --> Main
Limits ..> Procs : bound the total
Feed ..> Queue : at its limit: loops pause
Feed ..> GraphBuild : at its limit: the build pauses
User ..> GraphBuild : watches usage, stops
```
