import { memo } from "react";
import { posCn } from "../design-system/posCn";

const TILES = [
  {
    id: "barcode",
    label: "Barcode Scan",
    icon: "▥",
    title: "USB barcode scanner types into search",
    available: true,
  },
  {
    id: "qr",
    label: "QR Scan",
    icon: "▦",
    title: "Camera QR capture is not configured on this host",
    available: false,
  },
  {
    id: "camera",
    label: "Camera",
    icon: "◉",
    title: "Camera product capture is not configured on this host",
    available: false,
  },
  {
    id: "manual",
    label: "Manual Entry",
    icon: "✎",
    title: "Manual cart line",
    available: true,
  },
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
      {TILES.map((tile) => {
        const live = tile.available && Boolean(handlers[tile.id]);
        return (
          <button
            key={tile.id}
            type="button"
            title={tile.title}
            aria-label={tile.label}
            disabled={!live}
            onClick={live ? handlers[tile.id] : undefined}
            className={posCn("pos-quick-action-tile")}
          >
            <span className="pos-quick-action-icon" aria-hidden>
              {tile.icon}
            </span>
            <span className="pos-quick-action-label">{tile.label}</span>
          </button>
        );
      })}
    </div>
  );
});
