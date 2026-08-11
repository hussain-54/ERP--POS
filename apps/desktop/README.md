# Electronic ERP — Windows Desktop POS

Production Electron shell with:

- Main process (SQLite, sync/device, hardware, updater, safeStorage)
- Secure preload IPC (`contextIsolation`, no Node in renderer)
- Local renderer for first-run + offline POS smoke
- NSIS installer via electron-builder

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
| SQLite + logs + config | `%APPDATA%\electronic-erp-pos\` (Electron `userData`) |

Uninstall does **not** delete AppData (`deleteAppDataOnUninstall: false`).

See `docs/DESKTOP_RELEASE.md` for full install / troubleshooting.
