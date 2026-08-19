import { memo } from "react";
import { POSButton } from "../design-system";

export const PosDiscoveryTools = memo(function PosDiscoveryTools({
  onBarcodeScan,
  onQrScan,
  onCamera,
  onManualEntry,
}: {
  onBarcodeScan?: () => void;
  onQrScan?: () => void;
  onCamera?: () => void;
  onManualEntry?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Product scan tools">
      <POSButton
        size="sm"
        variant="secondary"
        onClick={onBarcodeScan}
        title="USB barcode scanner types into search"
      >
        Barcode Scan
      </POSButton>
      <POSButton size="sm" variant="secondary" onClick={onQrScan} title="QR / camera scanner">
        QR Scan
      </POSButton>
      <POSButton size="sm" variant="secondary" onClick={onCamera} title="Camera recognition">
        Camera
      </POSButton>
      <POSButton size="sm" variant="ghost" onClick={onManualEntry} title="Manual cart line">
        Manual Entry
      </POSButton>
    </div>
  );
});
