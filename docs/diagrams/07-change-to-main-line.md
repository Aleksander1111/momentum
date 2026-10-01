# Change to main line

Source: [SPEC.md → Knowledge base](../SPEC.md#knowledge-base), [Consistency guard](../SPEC.md#consistency-guard), [Attention feed](../SPEC.md#attention-feed), [Database → entity](../SPEC.md#entity)

```mermaid
flowchart TB
  Run["Run — own detached checkout of the main line"]
  Change["Knowledge base change<br/>free read and write, nothing gates work in progress"]
  Guard["Consistency guard<br/>on every change"]
  Tx["Transaction<br/>everything the run left, one commit"]
  Valid{"Card limit and<br/>references valid?"}
  Issue["Issue entity, landed with the changes"]
  Moved{"Main line moved<br/>while the run ran?"}
  FF["Fast-forward"]
  Replay["Replayed onto the tip<br/>conflicting files take the run's side"]
  Conflict["Conflict entity<br/>over the files that conflicted"]
  Main["Main line — the one branch<br/>verification: unverified"]
  Index["Index follows the main line<br/>unverified enters the feed"]
  Feed["Attention feed"]
  User{"User"}
  Verified["One commit on the main line<br/>verification: verified"]
  Impl{"Implementable and<br/>nothing implements it?"}
  Ahead["sync: entity_ahead<br/>awaiting implementation"]
  Synced["sync: synced"]
  Back["Chat run with the comment<br/>sync: updating while the run lasts"]
  Run --> Change --> Guard --> Tx --> Valid
  Valid -->|"yes"| Moved
  Valid -->|"cannot be made consistent"| Issue --> Moved
  Moved -->|"no"| FF --> Main
  Moved -->|"yes"| Replay --> Main
  Replay -->|"conflicts"| Conflict --> Main
  Main --> Index --> Feed --> User
  User -->|"approves"| Verified --> Impl
  Impl -->|"yes"| Ahead
  Impl -->|"no"| Synced
  User -->|"sends back"| Back
```

A plan is an ordinary entity on this path: approved, it stands `entity_ahead` until implemented.

## Sync state

Maintained by the consistency guard, independent of verification.

```mermaid
stateDiagram-v2
  synced --> entity_ahead: approved, nothing implements it
  entity_ahead --> updating: implementation run targets it
  synced --> updating: run targets it, e.g. send back
  updating --> synced: run's transaction landed and approved
  synced --> artifact_ahead: artifact changed
  artifact_ahead --> updating: summarization rewrites the card
```
