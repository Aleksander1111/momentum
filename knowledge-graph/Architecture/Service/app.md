---
type: Architecture/Service
origin: automation
verification: unverified
sync: synced
product_impact: 4
timeline_impact: 2
unlocks: 3
references: []
artifacts:
  - apps/app/package.json
  - apps/app/app.json
  - apps/app/src/app/(tabs)/_layout.tsx
  - apps/app/src/lib/api.ts
  - apps/app/src/lib/query.ts
---
# App

The Momentum client: one Expo Router codebase for Android and web (react-native-web).

| Tab | Purpose |
|---|---|
| Feed | Swipe cards to approve or send back; counters by state |
| Explorer | Browse and search entities per workspace |
| Chat | Runs and their conversations |
| Metrics | Usage and automation charts over 24 h, 7 d, 30 d |
| Settings | Models, limits, graph build, theme |

- Typed API from @momentum/contract; web same-origin, native over the mesh with a SecureStore bearer token
- Offline: query cache persisted a week; reactions queue and resume when the API is back
