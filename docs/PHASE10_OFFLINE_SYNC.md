# Phase 10 — SQLite Offline Engine + Bidirectional Sync

Production offline path (not a demo mode). SQLite (Electron) mirrors the canonical ERP model.

## Local database

- DDL: `packages/offline/src/sync-schema.ts` (`OFFLINE_SYNC_ENGINE_SCHEMA`)
- Runtime: `LocalDatabase` + durable storage (memory/file; Electron can swap to better-sqlite3)
- Permanent `device_id` / `device_key` in `local_settings`
- Syncable envelope: id, device_id, version, timestamps, deleted_at, sync_state, last_synced_at

## Outbox / inbox

- Every mutation → `sync_outbox` (operation id, entity, payload, device, retry, status)
- Inbox applies server ops idempotently by `operation_id`
- Crash: `processing` → requeue to `pending` on open

## Sync

```
Offline: Local SQLite authoritative
Online:  SQLite → outbox → SyncCoordinator → SyncEngine → Node /api/v1/sync → Supabase
         Supabase change_log → pull → inbox → SQLite
```

Conflicts: server/client/latest/manual; sales/stock/payments → `transaction_reconcile` (append events, recompute stock).

## API

`/api/v1/sync/devices/register|push|pull|conflicts|status`

## Web

`/offline-pos`, `/sync`

## Verify

```bash
npm run build:packages
npm run test:phase10
npm run typecheck --prefix apps/api
npm run build --prefix apps/web
```
