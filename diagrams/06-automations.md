# Automations

Source: [SPEC.md → Automations](../SPEC.md#automations)

```mermaid
flowchart LR
  KB["Knowledge base — every layer"]
  Goals["Goals"]
  Feed["Attention feed"]
  Artifacts["Repository artifacts<br/>chats, plans, results implemented by AI"]
  Metrics["Index and metrics database"]
  HarnessRepo["Harness repository<br/>definitions, skills, sub-agents"]
  Workspaces["Workspaces using a variant"]
  User(["User"])
  subgraph Auto["Automations — per project, defined by responsibility alone"]
    Exploration["Exploration"]
    Preparation["Preparation"]
    Consistency["Consistency check"]
    Retention["Retention"]
    Implementation["Implementation"]
    Validation["Validation"]
    Optimization["Optimization"]
    Summarization["Summarization<br/>step inside the other automations"]
    Chat["Chat"]
  end
  Auto <-->|"search and write on own branch"| KB
  Goals -->|"guide; all met → idle"| Exploration
  Exploration -->|"next best action"| Feed
  Preparation -->|"plans as summaries"| Feed
  Consistency -->|"issue summaries"| Feed
  Retention -->|"retirement proposals"| Feed
  Implementation -->|"own branch"| Validation
  Validation -->|"issue or conflict summaries"| Feed
  Artifacts --> Summarization
  Summarization -->|"summaries"| KB
  Metrics --> Optimization
  Optimization --> HarnessRepo
  HarnessRepo -->|"materialized"| Workspaces
  User -->|"starts"| Chat
  Chat -->|"results"| Feed
```

## Step mechanism

```mermaid
flowchart LR
  Step["Step of a responsibility"]
  Q{"Expressible as a query or rule?"}
  Rules["Queries and rules<br/>indices, metrics, lifetimes, references"]
  AI["AI<br/>deciding, planning, reviewing, summarizing"]
  Step --> Q
  Q -->|"yes"| Rules
  Q -->|"no"| AI
```
