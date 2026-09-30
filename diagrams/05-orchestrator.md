# Orchestrator and runs

Source: [SPEC.md → Orchestrator](../SPEC.md#orchestrator), [Automations → Chat](../SPEC.md#automations)

```mermaid
flowchart TB
  Time["On time"]
  Demand["On demand<br/>incl. chat started by the user"]
  subgraph Backend["One back-end deployable"]
    API["API"]
    Orch["Orchestrator"]
  end
  Enabled{"Project enabled?"}
  NoLoops["No loops"]
  Loops["Automation loops, per project"]
  subgraph Procs["Run processes — isolated, killable, own resource limits"]
    R1["Run<br/>Claude Code process<br/>own checkout, own branch"]
    R2["Run<br/>Claude Code process<br/>own checkout, own branch"]
  end
  Feed["Attention feed"]
  Limits["Anthropic API limits"]
  Time --> Orch
  Demand --> Orch
  Orch --> Enabled
  Enabled -->|"no"| NoLoops
  Enabled -->|"yes"| Loops
  Loops -->|"several runs per project"| R1
  Loops --> R2
  Limits -. "bound concurrency" .-> Procs
  Feed -. "at its limit: loops pause" .-> Loops
```
