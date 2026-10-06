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

Ranked cards from enabled projects, one at a time:

- Breadcrumb: project logo, type pill, folders; verification and sync counters
- A card changed since verified shows a diff: −/+ word counts, marked changes, diagrams Before/After/Diff
- Linked entities show type glyph, colour; open on a press; only web links open
- Selections go to chat
- Swipe right approves; left sends back with a comment
- Issue cards add severity, concerns, options: right resolves with the pick; left takes a resolution or won't-resolve reason
- A reaction carries time on card and version: one changed meanwhile is refused, shown again; polls every 15 s; queues offline
- Cards take the palette set in Settings live
