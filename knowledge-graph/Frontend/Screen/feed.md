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
kind: page
---
# Feed screen

Ranked cards across enabled projects, one at a time.

- Counters: verification and sync pills, a count per state
- A card changed since last verified shows the diff: −/+ word counts; words, rows, items and code lines marked; whole blocks tinted; a diagram as Before/After/Diff
- Selected text and diagram shapes go to the chat context; on the web the right button selects, the left swipes
- Swipe right approves; left opens a Disapprove sheet whose comment is sent back
- Issue cards add severity, category, concerns, options: right resolves with the pick; left takes your resolution or a won't-resolve reason
- Time on the card goes with the reaction
- Polls every 15 s; reactions queue offline
