---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 0
unlocks: 2
references: []
artifacts:
  - apps/app/src/app/(tabs)/feed.tsx
  - apps/app/src/lib/feed.ts
  - apps/app/src/ui/CardView.tsx
  - apps/app/src/ui/StateBadge.tsx
  - docs/designs/feed-web.png
  - docs/designs/feed-mobile.png
  - docs/designs/feed-approve-web.png
  - docs/designs/feed-approve-mobile.png
  - docs/designs/feed-sendback-web.png
  - docs/designs/feed-sendback-mobile.png
kind: page
---
# Feed screen

Ranked cards across enabled projects, one at a time; the default tab.

- Counters above the stack: entities of the enabled projects by verification (unverified, verified) and sync (synced, entity ahead, artifact ahead, updating)
- Swipe right approves; swipe left opens a Disapprove sheet whose comment is sent back (Cancel returns the card)
- APPROVE and DISAPPROVE stamps and a green or red wash follow the drag; two cards peek behind
- Web drags with the mouse the same way; no buttons; light or dark theme
- Time spent on the item is sent with the reaction
- Polls `GET /feed` every 15 s; a reacted card leaves at once, counters wait for the next poll, reactions queue while the API is down
