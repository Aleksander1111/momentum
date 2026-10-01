---
type: Architecture/Service
origin: automation
verification: unverified
sync: synced
product_impact: 1
timeline_impact: 0
unlocks: 2
references:
  - to: Architecture/System/momentum-harness
    relation: part_of
  - to: Architecture/Api/http-api
    relation: consumes
  - to: Architecture/Dependency/contract
    relation: depends_on
artifacts:
  - apps/app/package.json
  - apps/app/app.json
  - apps/app/src/app/(tabs)/_layout.tsx
  - apps/app/src/lib/api.ts
  - docs/diagrams/03-front-end.md
---
# App

One Expo (React Native) app, `apps/app`, written once for web and mobile.

- Expo Router with five tabs: Feed, Explorer, Chat, Metrics, Settings; bottom bar under 700 px wide, left rail above
- Web build exported to static files and served same-origin by the back-end; native reaches the API at `EXPO_PUBLIC_API_URL` over the mesh
- TanStack Query polls (feed and chats every 15 s, an active run every 3 s); the last good data persists in AsyncStorage and reactions queue while the API is unreachable
- Session token in an httpOnly cookie on web, SecureStore on mobile
- Android APK built locally; iPhone uses the web build as a PWA
