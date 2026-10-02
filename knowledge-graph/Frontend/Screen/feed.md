---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 3
timeline_impact: 1
unlocks: 2
references:
  - to: Harness/Automation/consistency-check
    relation: resolves_issues_of
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

Ranked cards across enabled projects, one at a time.

- Counters: two pills, verification then sync, each state an icon and count, dimmed at zero, named on hover
- Swipe right approves; swipe left opens a Disapprove sheet whose comment is sent back
- An issue card adds severity, category, concerned entities and options, the recommended one picked: swipe right resolves with the pick; swipe left opens Your resolution: Send resolves with the text, Won't resolve closes with the reason
- Stamps and a wash follow the drag
- Time on the card goes with the reaction
- Polls every 15 s; a reacted card leaves at once
- Reactions queue offline and resume after restart; stale cache is dropped
