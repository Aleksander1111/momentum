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
  - apps/app/src/lib/query.ts
  - apps/app/src/ui/theme.ts
  - apps/app/src/ui/AppearanceProvider.tsx
  - docs/diagrams/03-front-end.md
---
# App

One Expo (React Native) app, `apps/app`, written once for web and mobile.

- Expo Router, five tabs: Feed, Explorer, Chat, Metrics, Settings; bottom bar under 700 px, left rail above
- Light and dark palettes; Settings picks system, light or dark, saved per device
- Web build served same-origin by the back-end; native uses `EXPO_PUBLIC_API_URL`
- TanStack Query polls (feed, chats 15 s; live run 3 s); last good data kept in AsyncStorage, reactions queue offline and resume after restart
- Restored cache checked against the contract; stale shapes dropped and refetched
- Session: httpOnly cookie on web, SecureStore on mobile
- Android APK built locally; iPhone uses the web build as PWA
