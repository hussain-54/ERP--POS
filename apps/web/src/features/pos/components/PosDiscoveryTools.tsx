import { memo } from "react";
import { posCn } from "../design-system/posCn";

const TILES = [
  { id: "barcode", label: "Barcode Scan", icon: "▥", title: "USB barcode scanner types into search" },
  { id: "qr", label: "QR Scan", icon: "▦", title: "QR / camera scanner" },
  { id: "camera", label: "Camera", icon: "◉", title: "Camera recognition" },
  { id: "manual", label: "Manual Entry", icon: "✎", title: "Manual cart line" },
] as const;

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
  const handlers = {
    barcode: onBarcodeScan,
    qr: onQrScan,
    camera: onCamera,
    manual: onManualEntry,
  };

  return (
    <div className="pos-quick-actions" role="toolbar" aria-label="Product scan tools">
      {TILES.map((tile) => (
        <button
          key={tile.id}
          type="button"
          title={tile.title}
          aria-label={tile.label}
          onClick={handlers[tile.id]}
          className={posCn("pos-quick-action-tile")}
        >
          <span className="pos-quick-action-icon" aria-hidden>
            {tile.icon}
          </span>
          <span className="pos-quick-action-label">{tile.label}</span>
        </button>
      ))}
    </div>
  );
});
