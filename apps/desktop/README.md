# ERP System — Windows Desktop POS

Production Electron shell with:

- Main process (device config, hardware, updater, safeStorage)
- Secure preload IPC (`contextIsolation`, no Node in renderer)
- Local renderer for first-run provisioning, hardware checks, and updates
- NSIS installer via electron-builder

Sales are **online-only** via the cloud API / Supabase (no local SQLite outbox).

## Quick commands (from monorepo root)

```bash
npm install
npm run build:desktop          # compile main + copy preload
npm run desktop:prepare        # dependency / packaging readiness check
npm run desktop:dev            # run unpackaged Electron
npm run desktop:pack           # unpacked win-unpacked dir
npm run desktop:dist           # NSIS installer under apps/desktop/release/
```

## Data locations

| Kind | Location |
|------|----------|
| Install files | Program Files / chosen install dir |
| Config + logs | `%APPDATA%\electronic-erp-pos\` (Electron `userData`) |

Uninstall does **not** delete AppData (`deleteAppDataOnUninstall: false`).

See `docs/DESKTOP_RELEASE.md` for full install / troubleshooting.
