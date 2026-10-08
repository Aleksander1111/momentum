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
  - apps/app/tsconfig.json
  - apps/app/assets
  - apps/app/public
  - apps/app/modules
---
# App

One Expo (React Native) app, `apps/app`, for web and mobile.

- Six tabs: Feed, Explorer, Sessions, Timeline, Metrics, Settings; bottom bar when narrow, left rail when wide; Settings a corner icon on a phone
- The Sessions tab badges waiting context parts
- Tabs stay mounted; Back walks the history
- Light or dark as chosen in Settings, kept on the device; System follows it
- Web served same-origin by the back-end; native calls `EXPO_PUBLIC_API_URL`
- Out of reach: queries pause, reactions queue, a 5 s probe restores them, a refusal says why; a phone shows a bar above the tabs
- Typed contract client; 401 sends to sign-in; sign-out ends this device's session
