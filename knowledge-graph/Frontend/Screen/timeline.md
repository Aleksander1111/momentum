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

- The user's actions: sign-ins, reactions, chats, settings, projects switched on and off
- One event per run, updated as it runs and lands: its automation, model, time taken and share of the limits, and what it changed
- What the harness did on its own, such as switching off a project that left one straight line
- Filtered by project, and by actor: all, you, runs, harness
- The newest page is polled every 4 s; Show older fetches each older page once
- An entity an event names opens on a press
