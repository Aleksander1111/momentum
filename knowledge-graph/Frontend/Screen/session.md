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
---
# Session screen

Signs the user in with the shared password and establishes the per-device session on top of the mesh.

- Momentum logo, one password field (lock icon, autofocus, submit on Enter) and a Sign in button, centred and at most 340 px wide; follows the light or dark theme
- A failure marks the field and says why: wrong password, Momentum out of reach, or try again; it clears on the next keystroke. Success refetches all queries and replaces the route with the Feed
- Web keeps the session in an httpOnly cookie; mobile stores the returned token in SecureStore
- Reached at `/session`: a 401 clears the token and redirects here, once; Sign out in Settings returns here
