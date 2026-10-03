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

- Six tabs: Feed, Explorer, Chat, Timeline, Metrics, Settings; bottom bar when narrow, left rail when wide; Settings is a corner icon on a phone; none embedded in the e2e observer
- Light or dark follows the system
- Web served same-origin by the back-end; native calls `EXPO_PUBLIC_API_URL` on the mesh
- A failed fetch pauses queries, queues reactions; a 5 s probe restores them
- Typed `@momentum/contract` client: feed, entities, search, chats, runs, metrics, timeline, graph build, settings
- 401 clears the token, back to sign-in; token in a cookie on web, SecureStore on mobile
- Momentum icon, favicon; Android APK built locally
