# Desktop (Electron) — build preparation

This package is a **scaffold only**. It exists so Phase 18 can document and check Electron packaging readiness.

## Status: NOT production-ready (CRITICAL)

Blockers:

1. Install Electron + electron-builder when packaging is approved
2. Wire `packages/offline` to native SQLite (`better-sqlite3`) instead of memory/JSON-only durability
3. Bridge printer / scanner / drawer via main-process IPC (web currently uses memory adapters)
4. Store session secrets with Electron `safeStorage`

## Commands

```bash
npm run prepare:check --prefix apps/desktop
npm run typecheck --prefix apps/desktop
```

Do **not** ship store POS from this package until `docs/PRODUCTION_READINESS.md` marks Electron as READY.
