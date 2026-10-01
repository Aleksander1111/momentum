---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 2
unlocks: 2
references:
  - to: Governance/DesignDoc/spec
    relation: part_of
artifacts:
  - docs/SPEC.md
---
# Spec: deployment and open questions

- No fixed stack; built in one pass; Claude Code native; drivable by voice
- Self-hosted on one dedicated machine; no cloud services
- Clients reach it over a private WireGuard mesh (Tailscale): no public port, per-device keys, per-user session

Open questions:
- Adding and retiring workspaces
- Agents beyond the automations
- Validation form per kind of work
- Tuning the ranking
- Sync with sources
- Claude Code integration surface
- Scale, latency, usage targets, offline mobile
