# Phase 11 — Hardware + Printing + Scanning

All device I/O goes through `HardwareService` adapter ports. Missing hardware returns structured status — it must not crash the app.

## Scanners

- USB keyboard-wedge (`UsbKeyboardWedgeScanner`)
- QR (`QrScannerAdapter`)
- Camera / mobile / tablet (`CameraScannerAdapter`)

Statuses: connected, disconnected, unavailable, permission_denied, idle.

## Printers

Media: A4, 80mm, 58mm, barcode, label.

Documents: sales/purchase invoice, payment/installment receipt, quotation, delivery challan, warranty card, repair job card, barcode label, stock report.

## Cash drawer

`cash_drawer.open` permission + audit (`hardware_events` + `audit_logs`).

## Barcodes

Generate/bulk via catalog API; scan/label/reprint via `BarcodeHardwareService`.

## API / UI

`/api/v1/hardware/*` · `/printing` · `/devices`

## Verify

```bash
npm run build:packages
npm run test:phase11
npm run typecheck --prefix apps/api
npm run build --prefix apps/web
```
