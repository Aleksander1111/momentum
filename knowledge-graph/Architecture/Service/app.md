---
type: Architecture/Service
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references: []
artifacts:
  - apps/app/package.json
  - apps/app/app.json
  - apps/app/src/app/(tabs)/_layout.tsx
  - apps/app/src/lib/api.ts
---
# App

One Expo (React Native) app, `apps/app`, for web and mobile.

- Six tabs: Feed, Explorer, Chat, Timeline, Metrics, Settings; bottom bar when narrow, left rail when wide; Settings a corner icon on a phone; none when embedded
- The Chat tab badges the card parts waiting for the next message
- Tabs stay mounted: one shown again refetches what went stale; Back walks the history, so an entity a chat links returns to the chat
- Light or dark follows the system
- Web served same-origin by the back-end; native calls `EXPO_PUBLIC_API_URL`
- A failed fetch pauses queries, queues reactions; a 5 s probe restores them; a refused one shows why
- Typed contract client; 401 sends back to sign-in
