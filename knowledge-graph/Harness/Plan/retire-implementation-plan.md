---
type: Harness/Plan
origin: requested
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 1
unlocks: 1
references:
  - to: Governance/DesignDoc/plan
    relation: retires
  - to: Governance/DesignDoc/plan/approval
    relation: retires
  - to: Governance/DesignDoc/plan/implementation-decisions
    relation: retires
  - to: Governance/DesignDoc/plan/mapping
    relation: retires
  - to: Governance/DesignDoc/plan/models
    relation: retires
  - to: Governance/DesignDoc/plan/pages
    relation: retires
  - to: Governance/DesignDoc/plan/repository-and-entities
    relation: retires
  - to: Governance/DesignDoc/plan/technology
    relation: retires
  - to: Governance/DesignDoc/plan/technology-data
    relation: retires
  - to: Governance/DesignDoc/plan/technology-platform
    relation: retires
  - to: Governance/DesignDoc/plan/technology-runs
    relation: retires
  - to: Governance/DesignDoc/plan/work-package-scope
    relation: retires
  - to: Governance/DesignDoc/plan/work-packages
    relation: retires
artifacts: []
---
# Retire the implementation plan

The implementation plan is no longer needed (user, from the feed): the harness it planned stands built.

- Retires the plan and every part of it: repository and entities, pages, models, technology, approval, graph build, implementation decisions, work packages and their scope
- Approving it deletes all thirteen from the main line in one commit
