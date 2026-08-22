import { memo } from "react";
import { posCn } from "../design-system/posCn";

export type PosSaleQuickActionId =
  | "hold"
  | "resume"
  | "clear"
  | "customer"
  | "discount"
  | "payment";

type Tile = {
  id: PosSaleQuickActionId;
  label: string;
  icon: string;
  title: string;
  disabled?: boolean;
};

type Props = {
  canHold: boolean;
  canDiscount: boolean;
  canClear: boolean;
  canPay: boolean;
  holdCount?: number;
  onAction: (id: PosSaleQuickActionId) => void;
};

export const PosSaleQuickActions = memo(function PosSaleQuickActions({
  canHold,
  canDiscount,
  canClear,
  canPay,
  holdCount = 0,
  onAction,
}: Props) {
  const tiles: Tile[] = [
    {
      id: "hold",
      label: "Hold",
      icon: "⏸",
      title: canHold ? "Hold current sale (F2)" : "Requires pos.hold permission",
      disabled: !canHold,
    },
    {
      id: "resume",
      label: holdCount > 0 ? `Resume (${holdCount})` : "Resume",
      icon: "▶",
      title: "Open held sales to resume (F2)",
    },
    {
      id: "clear",
      label: "Clear",
      icon: "⌫",
      title: canClear ? "Clear cart — confirmation required (F7)" : "Cart is empty",
      disabled: !canClear,
    },
    {
      id: "customer",
      label: "Customer",
      icon: "👤",
      title: "Focus customer search (F3)",
    },
    {
      id: "discount",
      label: "Discount",
      icon: "%",
      title: canDiscount
        ? "Focus invoice discount (F5) — 10% or Rs amount"
        : "Requires POS discount permission",
      disabled: !canDiscount,
    },
    {
      id: "payment",
      label: "Payment",
      icon: "Rs",
      title: canPay ? "Go to payment (F6)" : "Add products before payment",
      disabled: !canPay,
    },
  ];

  return (
    <div
      className="pos-sale-quick-actions pos-quick-actions"
      role="toolbar"
      aria-label="Sale quick actions"
    >
      {tiles.map((tile) => (
        <button
          key={tile.id}
          type="button"
          className={posCn("pos-quick-action-tile", tile.disabled && "opacity-50")}
          title={tile.title}
          disabled={tile.disabled}
          onClick={() => onAction(tile.id)}
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
