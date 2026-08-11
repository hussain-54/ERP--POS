# Desktop Release — Windows Electron POS

**Product:** Electronic ERP POS  
**Version:** `0.1.0` (`apps/desktop/package.json`)  
**Phase:** 20  
**Platform:** Windows 10/11 **64-bit**  
**Packager:** electron-builder (NSIS)

---

## 1. What ships

| Artifact | How to build | Output |
|----------|--------------|--------|
| Development run | `npm run desktop:dev` | Unpackaged Electron |
| Unpacked dir | `npm run desktop:pack` | `apps/desktop/release/win-unpacked/` |
| Production installer | `npm run desktop:dist` | `apps/desktop/release/ElectronicERP-POS-Setup-0.1.0.exe` |

Installers are **gitignored** — do not commit `.exe` / `release/` unless explicitly required.

---

## 2. Architecture

```text
Renderer (renderer/*)  --typed IPC-->  Preload (preload.cjs)
                                            |
                                       Main process
                         ├── SQLite (better-sqlite3) in AppData
                         ├── Offline LocalDatabase + OfflinePosEngine
                         ├── HardwareService (fail-soft)
                         ├── safeStorage token helpers
                         └── DesktopUpdater (electron-updater)
```

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Renderer never opens SQLite or Node APIs
- Business DB is **not** stored under the install directory

---

## 3. Application data (Windows)

| Item | Path |
|------|------|
| User data root | `%APPDATA%\electronic-erp-pos\` (Electron `userData`; name follows `productName` / app id) |
| SQLite DB | `%APPDATA%\…\database\offline.db` (+ WAL/SHM) |
| Logs | `%APPDATA%\…\logs\` |
| Config / cache | `%APPDATA%\…\config\`, `cache\` |

NSIS `deleteAppDataOnUninstall: false` — uninstall/upgrade must not wipe POS business data.

---

## 4. First run

1. Create AppData folders  
2. Open/create SQLite DB  
3. Apply offline migrations (`packages/offline` migration plan)  
4. Create local device ID + device key  
5. Integrity check (`PRAGMA integrity_check`)  
6. If **not** provisioned:
   - Online: register via `POST /api/v1/sync/devices/register` (`platform: electron`) then save device locally  
   - Offline: UI explains that **initial** cloud registration / master-data download requires connectivity — **not faked**

After provisioning, offline POS engine supports local sales / pending outbox.

---

## 5. Build instructions

From monorepo root (Node 20+, Windows recommended for NSIS):

```bash
npm ci
npm run build:desktop      # packages + desktop compile + preload copy
npm run desktop:prepare    # verifies electron, better-sqlite3, builder, NSIS data safety
npm run desktop:dist       # NSIS installer
```

Channels:

| Channel | Command | Notes |
|---------|---------|-------|
| Development | `npm run desktop:dev` | Uses local AppData |
| Staging | `npm run dist:staging --prefix apps/desktop` | Same packager; point `ELECTRON_UPDATE_URL` / API at staging |
| Production | `npm run desktop:dist` | Sign builds in CI when certificates are available |

Native module note: `better-sqlite3` is rebuilt for Electron; first install may take several minutes.

---

## 6. Installation instructions

1. Copy `ElectronicERP-POS-Setup-*.exe` to the target PC  
2. Run installer (Windows 10/11 x64)  
3. Choose install directory (default OK)  
4. Desktop + Start Menu shortcuts are created  
5. Launch **Electronic ERP POS**  
6. Complete first-run provisioning while online (API URL + access token + org/branch IDs)  
7. Verify a smoke offline sale, then disconnect network and confirm pending sales still work  

Upgrade: run a newer installer over the existing app. AppData/SQLite is preserved.

---

## 7. Auto-update architecture

| Step | Behavior |
|------|----------|
| Check | `desktop:checkForUpdates` → electron-updater generic feed |
| Detect | `update-available` with version |
| Download | Explicit `desktop:downloadUpdate` (`autoDownload: false`) |
| Install | Explicit `desktop:quitAndInstall` only when downloaded — **no silent force** |
| Failure | Phase `error` + message; prior install remains |
| Disable | If `ELECTRON_UPDATE_URL` unset or app unpackaged → phase `disabled` |

Set feed URL in packaged environment:

```text
ELECTRON_UPDATE_URL=https://updates.example.com/electronic-erp-pos/
```

Publish `latest.yml` + installer artifacts to that URL for production.

---

## 8. Hardware

Desktop wires `HardwareService` with USB keyboard-wedge scanner + memory/null printers & drawer adapters by default (fail-soft). Missing hardware returns structured results and **does not crash** the app. Replace memory adapters with OS-specific printer drivers in a later hardening pass without changing IPC.

Supported capability surface: barcode scanner, thermal/A4/label/barcode printers, cash drawer, camera (null until configured).

---

## 9. Offline mode (post-provision)

Approved offline engine capabilities (via main IPC):

- Product / customer search (once master data synced into local stores)  
- Sales posting (`postOfflineSale`)  
- Pending sales / outbox  
- Payments / credit / installments / returns (engine + domain packages)  
- Stock validation on post  
- Receipt print / cash drawer (fail-soft)

Sync push/pull uses existing `SyncCoordinator` when online.

---

## 10. Installation test checklist

| Step | Expected |
|------|----------|
| Fresh Win10/11 x64 | Installer completes |
| Launch | Window opens; DB created under AppData |
| First-run offline | Clear message requiring connectivity |
| First-run online | Device registers; provisioned=yes |
| Smoke sale | Invoice appears in pending sales |
| Close / reopen | Same device id + pending sales persist |
| Uninstall app | AppData DB still present |
| Reinstall / upgrade | Data still present |

---

## 11. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `better-sqlite3` / NODE_MODULE_VERSION | Reinstall deps; rebuild for Electron (`npm rebuild better-sqlite3 --prefix apps/desktop`) |
| Blank window | Ensure `dist/preload.cjs` and `renderer/index.html` exist (`npm run build --prefix apps/desktop`) |
| Provision fails offline | Expected — connect to internet for first registration |
| Provision 401 | Check API URL + access token; API must be reachable |
| Updates disabled | Packaged build + set `ELECTRON_UPDATE_URL` |
| Vercel build | Desktop packaging must **never** run on Vercel — web only |
| `d3dcompiler_47.dll: Access is denied` during `electron-builder` | Windows Defender / Controlled Folder Access / AV often blocks extracting this Electron DLL. Exclude the output folder (or pause real-time scan), delete any partial `release/` / unpack dir, then re-run `npm run desktop:dist`. |

---

## 12. Remaining limitations (honest)

1. Renderer is a **desktop shell** (first-run + smoke POS), not the full React `apps/web` POS UI embedded yet.  
2. Printer adapters default to memory/null — production sites should plug real drivers.  
3. Code signing / SmartScreen not configured in this repo (add cert in CI).  
4. Full master-data download UI is API-driven; expand sync pull UX as needed.  
5. End-to-end installer test on a clean VM should be signed off by ops before store roll-out.  
6. On some developer PCs, **AV blocks** writing `d3dcompiler_47.dll` during packaging — CI or an AV exclusion is required to finish the NSIS `.exe` (compile + `prepare:check` still pass).

---

**STOP.** Do not treat unsigned CI artifacts as store-wide production until the checklist above is green on a clean Windows machine.
