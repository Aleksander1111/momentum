---
type: Governance/DesignDoc
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 1
references: []
artifacts:
  - docs/PLAN.md
---
# Client and access

- **App:** Expo + Expo Router, one app for web and mobile; web build served by the back-end
- **Gestures:** swipe right approves, left disapproves with a comment
- **Polling:** TanStack Query `refetchInterval`, no sockets; feed cached, reactions queue offline
- **Diagrams:** mermaid to SVG by the guard via Playwright in Windows' Edge; react-native-svg on mobile, image on web
- **Auth:** single user, generated or set password; httpOnly cookie on web, SecureStore on mobile, bearer for MCP; API on Tailscale only (`MOMENTUM_HOST` for local tests)
- **Voice tools:** API doubles as MCP server at `/mcp`, plus `run_automation`
- **Mobile:** sideloaded Android APK; iPhone uses the web PWA
