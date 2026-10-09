---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 2
unlocks: 2
references:
  - to: Governance/DesignDoc/spec/components
    relation: part_of
  - to: Governance/DesignDoc/components/api
    relation: depends_on
  - to: Governance/DesignDoc/components/attention-feed
    relation: concerns
artifacts:
  - docs/slides/slide-2.png
---
# Front-end

User actions on the phone, as the deck shows them:

- The [attention feed](Governance/DesignDoc/components/attention-feed) shows one entity card at a time; tabs: feed, explorer, chat, timeline, metrics
- Swipe left: send it back with a comment; a chat run works on it and the card shows it updating
- Swipe right: approve, one commit on the main line; when nothing implements it yet, an Implement run follows
- Also: chat (ask, steer), run on demand by voice tool, stop a run (what it wrote lands), projects (enable, build, reset), edit entities (commit to main), settings (limits, models)
