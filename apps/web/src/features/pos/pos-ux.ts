/**
 * Cashier UX helpers for the POS terminal.
 * No sale posting, stock, or payment math — those stay in domain.
 */

import {
  POS_SHORTCUT_EVENT,
  POS_SHORTCUTS,
  type PosShortcutAction,
} from "./pos-types";

export type ProductSearchCommand =
  | { kind: "search"; query: string; qty: string | null }
  | { kind: "qty-last"; qty: string };

/** True when a keydown originated in a field the cashier is typing into. */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest("[contenteditable='true']"));
}

const QTY_KEYS = new Set(["+", "=", "-", "_"]);

/** Printable keys that should land in product search when the cashier is not in a field. */
export function isProductSearchFocusKey(event: KeyboardEvent): boolean {
  if (isTypingTarget(event.target)) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.key.length !== 1) return false;
  if (event.key === " ") return false;
  if (QTY_KEYS.has(event.key)) return false;
  return true;
}

export function appendCharToSearchInput(input: HTMLInputElement, ch: string): void {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const next = `${input.value.slice(0, start)}${ch}${input.value.slice(end)}`;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, next);
  const caret = start + ch.length;
  input.setSelectionRange(caret, caret);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Barcode-first quantity suffixes used at the register:
 * `SKU*2` adds that product with qty 2; `*2` sets qty on the last cart line.
 */
export function parseProductSearchCommand(raw: string): ProductSearchCommand {
  const trimmed = String(raw ?? "").trim();
  const qtyLast = trimmed.match(/^\*(\d+(?:\.\d+)?)$/);
  if (qtyLast?.[1]) return { kind: "qty-last", qty: qtyLast[1] };
  const withQty = trimmed.match(/^(.*)\*(\d+(?:\.\d+)?)$/);
  if (withQty?.[1]?.trim() && withQty[2]) {
    return { kind: "search", query: withQty[1].trim(), qty: withQty[2] };
  }
  return { kind: "search", query: trimmed, qty: null };
}

export function saleHasUnsavedWork(cartLength: number): boolean {
  return cartLength > 0;
}

export function stockAvailabilityWarning(
  stock: string | number | null | undefined,
  qty: string | number,
): string | null {
  if (stock == null || stock === "") return null;
  const available = Number(stock);
  const wanted = Number(qty);
  if (!Number.isFinite(available) || !Number.isFinite(wanted)) return null;
  if (available <= 0) return "Out of stock — this product cannot be sold right now";
  if (wanted > available) {
    return `Only ${available} in stock — reduce quantity or choose another product`;
  }
  if (wanted >= available) return `Last ${available} unit${available === 1 ? "" : "s"} available`;
  if (available <= 5) return `Low stock: ${available} left`;
  return null;
}

export function priceOverrideWarning(catalogPrice: number, overridePrice: number): string | null {
  if (!Number.isFinite(catalogPrice) || !Number.isFinite(overridePrice)) return null;
  if (Math.abs(overridePrice - catalogPrice) < 0.005) return null;
  return `Catalog ${catalogPrice.toFixed(2)} → ${overridePrice.toFixed(2)}`;
}

export function addQtyStrings(base: string, extra: string): string {
  const sum = Number(base) + Number(extra);
  if (!Number.isFinite(sum) || sum < 0) return base;
  if (Number.isInteger(Number(base)) && Number.isInteger(Number(extra))) return String(sum);
  return String(sum);
}

/** Ctrl/Meta chords stay with the browser (copy, reload, new tab, find, …). */
export function isReservedBrowserChord(event: {
  ctrlKey: boolean;
  metaKey: boolean;
}): boolean {
  return event.ctrlKey || event.metaKey;
}

/**
 * F1–F8 cashier keys. Ignored when Ctrl/Meta/Alt/Shift is held so Alt+F4
 * and browser chords are not captured.
 */
export function matchPosFunctionShortcut(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}): PosShortcutAction | null {
  if (isReservedBrowserChord(event) || event.altKey || event.shiftKey) return null;
  const hit = POS_SHORTCUTS.find((row) => row.key === event.key);
  return hit?.action ?? null;
}

/** Hold must not fire while typing a hold reason; price override must not steal rate edits. */
const SHORTCUTS_BLOCKED_WHILE_TYPING: ReadonlySet<PosShortcutAction> = new Set([
  "price-override",
]);

export function resolvePosFunctionShortcut(event: KeyboardEvent): PosShortcutAction | null {
  const action = matchPosFunctionShortcut(event);
  if (!action) return null;
  // F1–F8 stay available in product search (industrial cashier habit).
  // Only block keys that would corrupt in-field editing.
  if (isTypingTarget(event.target) && SHORTCUTS_BLOCKED_WHILE_TYPING.has(action)) return null;
  return action;
}

/** Focus after React commits a mobile sheet / cart row. */
export function schedulePosFocus(find: () => HTMLElement | null | undefined): void {
  window.setTimeout(() => {
    find()?.focus();
  }, 0);
}

export function posShortcutFallbackPath(action: PosShortcutAction): string | null {
  switch (action) {
    case "new-sale":
      return "/pos";
    case "hold-resume":
      return "/pos/resume-sale";
    case "customers":
      return "/pos/customer-selection";
    case "discount":
      return "/pos?focus=discount";
    default:
      return null;
  }
}

export function isPosOverlayOpen(root: ParentNode | null = typeof document !== "undefined" ? document : null): boolean {
  if (!root) return false;
  return Boolean(root.querySelector('[aria-modal="true"]'));
}

/** Buttons, links, and tabs should keep native Enter / Space. */
export function isActionTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "BUTTON" || tag === "A" || tag === "SUMMARY") return true;
  const role = el.getAttribute("role");
  return role === "button" || role === "tab" || role === "menuitem" || role === "link";
}

export function dispatchPosShortcut(action: PosShortcutAction): boolean {
  const event = new CustomEvent<PosShortcutAction>(POS_SHORTCUT_EVENT, {
    detail: action,
    cancelable: true,
  });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

export function focusLastCartRate(): void {
  schedulePosFocus(() => {
    const nodes = document.querySelectorAll<HTMLInputElement>("[data-pos-cart-rate]");
    return nodes[nodes.length - 1];
  });
}

export function moveCartQtyFocus(currentIndex: number, delta: number): void {
  const next = document.querySelector<HTMLInputElement>(`[data-pos-cart-qty="${currentIndex + delta}"]`);
  next?.focus();
}
