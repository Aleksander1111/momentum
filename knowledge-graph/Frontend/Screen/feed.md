---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 0
unlocks: 2
references:
  - to: Architecture/Service/app
    relation: part_of
  - to: Architecture/Component/attention-feed
    relation: realises
artifacts:
  - apps/app/src/app/(tabs)/feed.tsx
  - apps/app/src/ui/CardView.tsx
  - docs/designs/feed-web.png
  - docs/designs/feed-mobile.png
  - docs/designs/feed-approve-mobile.png
  - docs/designs/feed-sendback-mobile.png
kind: page
---
# Feed screen

Ranked cards across enabled projects, one at a time; the default tab.

- Swipe right approves; swipe left opens a Disapprove sheet whose comment is sent back (Cancel returns the card)
- APPROVE and DISAPPROVE stamps and a green or red wash follow the drag; the next two cards peek behind
- Web drags with the mouse the same way; there are no buttons
- Time spent on the item is sent with the reaction
- Polls `GET /feed` every 15 s; a reacted card leaves at once, and reactions queue while the API is unreachable
