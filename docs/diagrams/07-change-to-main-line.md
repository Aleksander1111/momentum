# Change to main line

Source: [SPEC.md → Knowledge base](../SPEC.md#knowledge-base), [Consistency guard](../SPEC.md#consistency-guard), [Attention feed](../SPEC.md#attention-feed), [Database → entity](../SPEC.md#entity)

```mermaid
flowchart TB
  Run["Run — own checkout, own branch"]
  Change["Knowledge base change<br/>free read and write, nothing gates work in progress"]
  Guard["Consistency guard<br/>on every change"]
  Tx["Transaction<br/>related changes grouped"]
  Valid{"Card limit and<br/>references valid?"}
  Issue["Issue entity"]
  Index["Index and metrics database updated"]
  Feed["Attention feed<br/>verification: unverified"]
  User{"User"}
  Main["Main line — approved state<br/>verification: verified"]
  Impl{"Implementable and<br/>nothing implements it?"}
  Ahead["sync: entity_ahead<br/>awaiting implementation"]
  Synced["sync: synced"]
  Back["Change request, split into several entities,<br/>or new entities alongside it<br/>sync: updating while the run lasts"]
  Run --> Change --> Guard --> Tx --> Valid
  Valid -->|"yes"| Index --> Feed
  Valid -->|"cannot be made consistent"| Issue --> Feed
  Feed --> User
  User -->|"approves"| Main --> Impl
  Impl -->|"yes"| Ahead
  Impl -->|"no"| Synced
  User -->|"sends back"| Back
```

## Sync state

Maintained by the consistency guard, independent of verification.

```mermaid
stateDiagram-v2
  synced --> entity_ahead: approved, nothing implements it
  entity_ahead --> updating: implementation run targets it
  synced --> updating: run targets it, e.g. send back
  updating --> synced: run's transaction validated and approved
  synced --> artifact_ahead: artifact changed
  artifact_ahead --> updating: summarization rewrites the card
```
