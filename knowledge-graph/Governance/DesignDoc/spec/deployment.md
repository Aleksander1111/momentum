---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references: []
artifacts:
  - docs/SPEC.md
  - docs/diagrams/02-deployment.md
---
# Deployment and remote access

Self-hosted on one dedicated, resource-rich machine: back-end, agents and knowledge base; no cloud services or managed runtimes.

- Web and mobile clients poll the API over a private mesh network (WireGuard, e.g. Tailscale)
- API listens only on the mesh interface; no public port, inbound firewall rule, public reverse proxy or shared client secret
- One key per enrolled device, revoked centrally when lost
- Tunnel encrypts end to end; API also requires a per-user session
- Orchestrator starts one Claude Code process per run and project, each on its own checkout and branch of the workspace
