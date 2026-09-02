import type { CartLine, PosCustomerView } from "../types";
import { deviceHardware } from "@/features/devices/hardware-service";
import { hardwareApi } from "@/features/printing/hardware-api";

export interface CustomerDisplayState {
  type: "cart" | "payment" | "idle";
  storeName?: string;
  customerName?: string;
  items: Array<{
    name: string;
    qty: number;
    unit: string;
    price: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount?: number;
  changeReturned?: number;
  paymentMethod?: string;
  timestamp: string;
}

const DISPLAY_CHANNEL_NAME = "pos_customer_display_channel";
const DISPLAY_STORAGE_KEY = "erp_pos_customer_display_state";

/**
 * Broadcast current POS cart or payment state to Customer Display screens.
 */
export function broadcastCustomerDisplay(state: CustomerDisplayState) {
  try {
    localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(state));
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(DISPLAY_CHANNEL_NAME);
      channel.postMessage(state);
      channel.close();
    }
  } catch {
    // Ignore storage/broadcast errors
  }
}

/**
 * Broadcast live cart items and totals.
 */
export function broadcastCartToCustomerDisplay(
  lines: CartLine[],
  customer: PosCustomerView,
  totals: { subtotal: number; totalDiscount: number; tax: number; grand: number },
  storeName = "Electronic Store",
) {
  broadcastCustomerDisplay({
    type: lines.length > 0 ? "cart" : "idle",
    storeName,
    customerName: customer.label,
    items: lines.map((l) => ({
      name: l.name,
      qty: l.qty,
      unit: l.unitLabel,
      price: l.rate,
      total: l.qty * l.rate - l.discount,
    })),
    subtotal: totals.subtotal,
    discount: totals.totalDiscount,
    tax: totals.tax,
    grandTotal: totals.grand,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast sale completion / payment result.
 */
export function broadcastSalePaymentToCustomerDisplay(
  grandTotal: number,
  paidAmount: number,
  changeReturned: number,
  paymentMethod = "Cash",
  storeName = "Electronic Store",
) {
  broadcastCustomerDisplay({
    type: "payment",
    storeName,
    items: [],
    subtotal: grandTotal,
    discount: 0,
    tax: 0,
    grandTotal,
    paidAmount,
    changeReturned,
    paymentMethod,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Trigger physical or simulated cash drawer kick pulse.
 */
export async function triggerCashDrawerKick(reason = "Cash Sale", userId?: string): Promise<boolean> {
  try {
    await deviceHardware.openDrawer({ userId, reason });
    await hardwareApi.openDrawer({ reason, userId }).catch(() => null);
    return true;
  } catch {
    return false;
  }
}
