# 1. Keep notes in memory for now

Accepted, 2024-01.

The store is an interface (`src/store/store.ts`) with one implementation that keeps notes in an array. Nothing
survives a restart. That is enough while the API is used from one laptop; a file or database store slots in behind
the same interface when the notes must outlive the process.
