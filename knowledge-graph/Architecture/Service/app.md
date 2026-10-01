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

- Expo Router with five tabs: Feed, Explorer, Chat, Metrics, Settings; bottom bar under 700 px, left rail above
- Light and dark palettes; Settings picks system, light or dark, saved per device; routes re-render on change
- Web build exported as static files, served same-origin by the back-end; native reaches the API at `EXPO_PUBLIC_API_URL`
- TanStack Query polls (feed and chats 15 s, active run 3 s); last good data kept in AsyncStorage, reactions queue offline, resume after restart
- Session token: httpOnly cookie on web, SecureStore on mobile
- Android APK built locally; iPhone uses the web build as PWA
