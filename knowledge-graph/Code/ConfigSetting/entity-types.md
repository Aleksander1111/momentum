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

The types every entity in every project takes, one row each: domain, type and what it is for.

- An entity's path starts with its type, Domain/Type; a type not in the table is flagged by the consistency guard: the run is sent back, what remains lands as a Harness/Issue
- Twelve domains, Product and Governance to Knowledge and Harness, each with its glyph and colour
- Harness: automations, triggers, issues, conflicts, plans, research, patterns, reports
- A Harness/Pattern is a skill, sub-agent, memory or retrieval candidate from the chats, or a pattern in the user's reactions
- Runs list the types with the momentum-kb types tool
- Changed like any entity, approved in the feed
