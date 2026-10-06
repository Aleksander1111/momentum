---
type: Code/ConfigSetting
origin: user
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 2
references:
  - to: Code/Repository/momentum
    relation: part_of
artifacts:
  - docs/entity-types.tsv
---
# Entity types

The types every entity in every project takes, one per row of a table: domain, type and what the type is for.

- An entity's path starts with its type, Domain/Type; a type not in the table is flagged by the consistency guard: the run is sent back to fix it, and what it still leaves lands with a Harness/Issue
- Twelve domains, from Product and Governance to Knowledge and Harness; each has its glyph and colour in the app
- The Harness domain holds the harness's own entities: automations, triggers, issues, conflicts, chats, plans, research, patterns and reports
- Runs list the types with the types tool of momentum-kb
- Changed like any entity: edit the table, approve the change in the feed
