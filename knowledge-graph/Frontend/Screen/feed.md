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
  - apps/app/src/ui/Conversation.tsx
kind: page
---
# Feed screen

Ranked cards of included projects, one on top, two behind.

- Breadcrumb: logo, type, folders; verification and sync counters
- Diff since verified: words, marks, diagrams
- Long cards scroll, the bottom fading until the end; tables keep width
- Links open; a selection or shape opens the card's chat with it
- Right approves; left asks rework in a comment
- Pulled up at its end, it opens its chat below, closed on change or reaction
- Issues add severity, concerns, options; right resolves with the recommended, left takes a resolution or reason not to
- Reactions carry time on card, approve and resolve the version; polls 15 s, queues offline
- Top card stays till reacted to; empty says why
