---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 3
references:
  - to: Governance/DesignDoc/spec
    relation: part_of
artifacts:
  - docs/SPEC.md
---
# Spec: database

One store per workspace, updated by the guard on every validated transaction.

| Table | Holds |
|---|---|
| entity | Path, type, title, card, origin, verification, sync |
| entity_artifact | Summary ↔ artifact |
| entity_reference | From, to, relation; `implements` drives sync |
| chat | Summary ↔ run |
| automation | Responsibility, definition, trigger |
| run | Branch, checkout, trigger, target, usage |
| attention_ranking | Three impacts, rank |
| *_metric, attention_pattern | Metrics over time |

Sync: synced, entity_ahead, artifact_ahead, updating; independent of verification.
