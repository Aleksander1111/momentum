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
  - apps/app/src/lib/snapshot.ts
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
- Own entry `index.ts` → `src/App.tsx`: `ExpoRoot` over the routes under `src/app`
- Exported with one project's graph (`snapshot.js` sets `momentumSnapshot` before the app; `pnpm momentum export-graph`): the Explorer alone, no tabs, mic, agent, questions or context; workspaces, types, entities and search answered from the graph, no server reached. Opened from its file, it starts on `/explorer` and `snapshot.js` keeps the browser's history in memory, as the file's address cannot change
