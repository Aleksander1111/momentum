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
  - docs/diagrams/03-front-end.md
---
# App

One Expo (React Native) app, `apps/app`, for web and mobile.

- Five tabs: Feed, Explorer, Chat, Metrics, Settings; bottom bar when narrow, left rail when wide
- Light or dark scheme follows the system
- Web served same-origin by the back-end; native calls `EXPO_PUBLIC_API_URL` over the mesh
- A failed fetch pauses queries and queues reactions; a 5 s probe restores them
- Typed client over `@momentum/contract`: feed and its reactions (approve, send back, resolve, won't resolve), entities, search, chats, runs, metrics by range, graph build, reset, settings
- 401 clears the token and returns to sign-in; token in a cookie on web, SecureStore on mobile
- Android APK built locally
