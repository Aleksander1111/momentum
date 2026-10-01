---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 3
unlocks: 4
references: []
artifacts:
  - docs/SPEC.md
  - docs/diagrams/02-deployment.md
---
# Deployment and remote access

Self-hosted on one dedicated machine; no cloud services.

- One back-end deployable (API + orchestrator); runs are separate Claude Code processes, one per run and project, each in its own checkout and branch
- Workspaces root holds each workspace: git repository, knowledge base, index and metrics database
- Web and mobile clients poll the API over a private WireGuard mesh (e.g. Tailscale); the API listens only on the mesh interface
- No public port, inbound firewall rule, public reverse proxy or shared client secret
- One key per enrolled device, revoked centrally; tunnel encryption plus a per-user session
