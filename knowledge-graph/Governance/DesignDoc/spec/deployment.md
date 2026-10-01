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

Self-hosted on one dedicated, resource-rich machine; no cloud services or managed runtimes.

- One back-end deployable (API + orchestrator), the agents and the knowledge base on that machine
- One Claude Code process per run, each in its own checkout and branch of the workspace
- Web and mobile clients reach it only over a private WireGuard mesh (e.g. Tailscale); the API listens on the mesh interface only
- Each device enrolled once with its own key, revoked centrally when lost
- Tunnel encrypts traffic; the API also requires a per-user session
- No public port, inbound firewall rule, public reverse proxy or shared client secret
