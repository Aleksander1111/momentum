---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 3
unlocks: 3
references:
  - to: Governance/DesignDoc/plan
    relation: part_of
  - to: Harness/Automation/chat
    relation: concerns
artifacts: []
---
# Approval, send back and issue resolution

- `verification` and `sync` are independent states
- Approve: one commit sets verified, removes `retires` targets, syncs `implements` targets; an implementable entity without `implements` becomes `entity_ahead`
- Send back: a chat run with the comment as prompt, the entity as target; `updating` till it lands
- Resolve an issue: the picked option (approved) or the user's text (sent back) starts a chat run that applies it to the concerned entities and retires the issue
- Won't resolve: verified with `wont_resolve`, no longer a contradiction; rejected
- Artifact change → `artifact_ahead`; failed validation, landing conflicts and invalid transactions → issue or conflict entities
