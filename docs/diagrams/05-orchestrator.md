# Orchestrator and runs

Source: [SPEC.md → Orchestrator](../SPEC.md#orchestrator), [Automations → Chat](../SPEC.md#automations)

```mermaid
flowchart TB
  Trig["Trigger entities, per workspace<br/>schedule, event, on demand"]
  Demand["Chat, send back, automation on demand<br/>started by the user"]
  Enable["Project enabled by the user"]
  subgraph Backend["One back-end deployable"]
    API["API"]
    Orch["Orchestrator"]
  end
  Enabled{"Project enabled?"}
  NoLoops["No loops"]
  Queue["Automation runs, per project<br/>queued, one at a time"]
  GraphBuild["Graph build: knowledge graph built from the repository<br/>run after run until covered or stopped"]
  subgraph Procs["Run processes — isolated, killable, own resource limits"]
    R1["Automation run<br/>Claude Code process<br/>own checkout of the main line"]
    R2["User-started run<br/>Claude Code process<br/>own checkout of the main line"]
  end
  Main["Main line — the one branch<br/>every run lands on it when it ends"]
  Feed["Attention feed"]
  Limits["Anthropic API limits"]
  Trig --> Orch
  Demand --> Orch
  Enable --> Orch
  Orch --> Enabled
  Enabled -->|"no"| NoLoops
  Enabled -->|"yes"| Queue
  Enabled -->|"yes, until covered"| GraphBuild
  Queue -->|"one automation run per project"| R1
  GraphBuild -->|"one run at a time<br/>at most the feed's room"| R1
  Demand -->|"at once, alongside"| R2
  R1 --> Main
  R2 --> Main
  Limits -. "bound the total" .-> Procs
  Feed -. "at its limit: loops pause" .-> Queue
  Feed -. "at its limit: the build pauses" .-> GraphBuild
  User(["User"]) -. "watches usage, stops" .-> GraphBuild
```
