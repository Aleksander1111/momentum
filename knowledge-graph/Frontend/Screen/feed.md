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
  - apps/app/src/lib/query.ts
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

- Counters: two pills, verification then sync, each state a coloured line icon and count, dimmed at zero, named on hover or long-press
- Swipe right approves; swipe left opens a Disapprove sheet whose comment is sent back; Cancel returns the card
- Stamps and a green or red wash follow the drag; the wash redraws on light/dark change; two cards peek behind
- Web drags with the mouse; no buttons
- Time on the card is sent with the reaction
- Polls `GET /feed` every 15 s; a reacted card leaves at once and stays hidden until a newer poll
- Reactions queue offline and resume after restart; stale cached data is dropped
