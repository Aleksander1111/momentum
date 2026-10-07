---
type: Frontend/Screen
origin: user
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 1
references: []
artifacts:
  - apps/app/src/app/(tabs)/timeline.tsx
kind: page
---
# Timeline screen

What happened in the harness, newest first, grouped by day:

- The user's actions: sign-ins, reactions, chats, settings, projects on and off
- One event per run once it lands or ends: automation, trigger, model, time taken, share of the limits, what it changed
- Queued & running, a button with its count: running, then queued runs, time run or waited, why queued, model, risk; a run opens on a press
- What the harness did on its own, such as switching off a project that left one line
- Filtered by project, and by actor: all, you, runs, harness
- The newest page and the runs under way are polled every 4 s; Show older fetches each older page once
- An entity an event names opens on a press
