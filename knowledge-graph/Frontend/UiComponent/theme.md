---
type: Frontend/UiComponent
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 2
references:
  - to: Frontend/Screen/chat
    relation: used_by
  - to: Frontend/Screen/settings
    relation: used_by
artifacts:
  - apps/app/src/ui/theme.ts
---
# Theme

The app's colours, fonts and layout width.

- Light and dark palettes; `C` reads the scheme in effect, read while rendering; every route calls `useTheme()` so it renders again when [Settings](Frontend/Screen/settings) or the device switches scheme
- Named colours: ink, muted, accent, ok, warn, no with washes; saturated entity-state icon colours; diff marks; diagram backdrops
- Run state colour (`runColour`): running green, queued amber, failed red, finished and stopped muted, as on the [Sessions screen](Frontend/Screen/chat)
- Fonts: serif heads, sans body, mono
- Wide layout (left rail, split panes) from 700 px
