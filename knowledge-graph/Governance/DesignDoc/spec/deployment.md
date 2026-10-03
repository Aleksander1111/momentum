---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 3
unlocks: 3
references: []
artifacts:
  - docs/SPEC.md
  - docs/diagrams/02-deployment.md
---
# Deployment and remote access

Self-hosted on one dedicated machine: one back-end deployable (API + orchestrator), a Claude Code process per run, and the workspaces root. No cloud services.

```plantuml
left to right direction
rectangle "Web / mobile" as C
rectangle "Mesh VPN" as M
rectangle "API" as A
rectangle "Orchestrator" as O
rectangle "Runs" as R
rectangle "Workspaces" as W
C --> M : poll + session
M --> A : tunnel
O --> R
A --> W
R --> W
```

- No public port: the API listens only on a WireGuard mesh (e.g. Tailscale)
- One key per enrolled device, revoked centrally
- Tunnel encryption plus a per-user session; no firewall rule, reverse proxy or client secret
