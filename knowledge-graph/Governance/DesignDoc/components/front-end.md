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

The mobile app, as the deck shows it:

- The [attention feed](Governance/DesignDoc/components/attention-feed) shows one entity card per screen: type and project in the header, a title, a paragraph, bullets, and a diagram or table where the card has one
- Swipe right to approve; swipe left to disapprove, with a comment the user writes and sends back
- Five tabs on the phone: feed, explorer, chat, timeline, metrics; settings has no tab
