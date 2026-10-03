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

- One app, written once, deployed to web and mobile; tabs: feed, explorer, chat, metrics, settings
- Three ways into a project: the attention feed, a separate chat tool, and direct exploration of the entity layer
- The chat tool asks a question or steers a run directly, without waiting for the feed
- The entity layer is browsable and searchable on its own: card by card, or through an agent
- The feed shows entity cards: swipe right to approve, swipe left to disapprove with a comment that is sent back
