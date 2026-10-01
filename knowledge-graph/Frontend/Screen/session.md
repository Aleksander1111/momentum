---
type: Frontend/Screen
origin: automation
verification: unverified
sync: synced
product_impact: 2
timeline_impact: 1
unlocks: 2
references: []
artifacts:
  - apps/app/src/app/session.tsx
  - docs/designs/session-web.png
  - docs/designs/session-mobile.png
---
# Session screen

Signs the user in with the shared password and establishes the per-device session on top of the mesh.

- Wordmark, one password field (lock icon, autofocus, submit on Enter) and a Sign in button, centred and at most 340 px wide; follows the light or dark theme
- A wrong password marks the field and stays on the page; the mark clears on the next keystroke. Success drops the query cache and replaces the route with the Feed
- Web keeps the session in an httpOnly cookie; mobile stores the returned token in SecureStore and sends it as a bearer token
- Reached at `/session`: a 401 from any request clears the token and redirects here, once
