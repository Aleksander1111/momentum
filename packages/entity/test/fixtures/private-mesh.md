---
type: Governance/Decision
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 3
references:
  - to: Architecture/Api/session
    relation: depends_on
artifacts:
  - chats/2026-09-30-remote-access.jsonl
---
# Remote access over a private mesh

No port is exposed to the public internet; clients reach the machine through a WireGuard mesh.

- API listens only on the mesh
- One key per enrolled device

| Layer | Protection |
|---|---|
| Tunnel | End-to-end encryption |

```mermaid
flowchart LR
  Client --> Mesh --> API
```
