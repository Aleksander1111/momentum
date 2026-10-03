# Change to main line

Source: [SPEC.md → Knowledge base](../SPEC.md#knowledge-base), [Consistency guard](../SPEC.md#consistency-guard), [Attention feed](../SPEC.md#attention-feed), [Database → entity](../SPEC.md#entity)

```plantuml
rectangle "Run — own detached checkout of the main line" as Run
rectangle "Knowledge base change\nfree read and write, nothing gates work in progress" as Change
rectangle "Consistency guard\non every change" as Guard
rectangle "Transaction\neverything the run left, one commit" as Tx
hexagon "Card limit and\nreferences valid?" as Valid
rectangle "Issue entity, landed with the changes" as Issue
hexagon "Main line moved\nwhile the run ran?" as Moved
rectangle "Fast-forward" as FF
rectangle "Replayed onto the tip\nconflicting files take the run's side" as Replay
rectangle "Conflict entity\nover the files that conflicted" as Conflict
rectangle "Main line — the one branch\nverification: unverified" as Main
rectangle "Index follows the main line\nunverified enters the feed" as Index
rectangle "Attention feed" as Feed
hexagon "User" as User
rectangle "One commit on the main line\nverification: verified" as Verified
hexagon "Implementable and\nnothing implements it?" as Impl
rectangle "sync: entity_ahead\nawaiting implementation" as Ahead
rectangle "sync: synced" as Synced
rectangle "Chat run with the comment\nsync: updating while the run lasts" as Back
Run --> Change
Change --> Guard
Guard --> Tx
Tx --> Valid
Valid --> Moved : yes
Valid --> Issue : cannot be made consistent
Issue --> Moved
Moved --> FF : no
FF --> Main
Moved --> Replay : yes
Replay --> Main
Replay --> Conflict : conflicts
Conflict --> Main
Main --> Index
Index --> Feed
Feed --> User
User --> Verified : approves
Verified --> Impl
Impl --> Ahead : yes
Impl --> Synced : no
User --> Back : sends back
```

A plan is an ordinary entity on this path: approved, it stands `entity_ahead` until implemented.

## Sync state

Maintained by the consistency guard, independent of verification.

```plantuml
hide empty description
state synced
state entity_ahead
state updating
state artifact_ahead
synced --> entity_ahead : approved, nothing implements it
entity_ahead --> updating : implementation run targets it
synced --> updating : run targets it, e.g. send back
updating --> synced : run's transaction landed and approved
synced --> artifact_ahead : artifact changed
artifact_ahead --> updating : summarization rewrites the card
```
