# Working in this repository

- All work happens on `main`, in this one working directory, `C:\Projects\momentum`. Never create, check out or switch to another branch, never add or enter a worktree, never work in a copy of the repository anywhere else.
- Commit straight to `main`, one change after another. This overrides any default to branch before committing.
- Every change the user asks for is committed, built and deployed: the back end and the web app serve `main`, and restart or export again on every commit that changes them. A change is not done until it is live.
- Momentum itself works on one straight line in one working directory: no branches, no merges, no worktrees, no run checkouts. Its runs work in the project's own working directory on `main`, one run at a time per project, in this repository and in the projects it runs.

# Checking UI

- Check a UI change only when the user asks for it. This overrides any default to verify after a change.
- The user runs everything in Firefox. A check runs in Firefox: Playwright `firefox.launch({ channel: 'moz-firefox' })`, as the e2e runner does. Never use the built-in Chromium browser pane or Chrome to check how something looks or behaves.
