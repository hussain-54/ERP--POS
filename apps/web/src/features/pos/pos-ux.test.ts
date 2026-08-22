import { describe, expect, it } from "vitest";
import {
  addQtyStrings,
  appendCharToSearchInput,
  dispatchPosShortcut,
  isActionTarget,
  isProductSearchFocusKey,
  isReservedBrowserChord,
  isTypingTarget,
  matchPosFunctionShortcut,
  moveCartQtyFocus,
  parseProductSearchCommand,
  posShortcutFallbackPath,
  priceOverrideWarning,
  resolvePosFunctionShortcut,
  saleHasUnsavedWork,
  stockAvailabilityWarning,
} from "./pos-ux";
import { POS_SHORTCUT_EVENT, POS_SHORTCUTS } from "./pos-types";

describe("POS cashier UX helpers", () => {
  it("parses barcode quantity suffixes without treating SKU asterisks as qty", () => {
    expect(parseProductSearchCommand("LED-12*2")).toEqual({
      kind: "search",
      query: "LED-12",
      qty: "2",
    });
    expect(parseProductSearchCommand("*3")).toEqual({ kind: "qty-last", qty: "3" });
    expect(parseProductSearchCommand("  sku  ")).toEqual({
      kind: "search",
      query: "sku",
      qty: null,
    });
    expect(parseProductSearchCommand("FOO*BAR")).toEqual({
      kind: "search",
      query: "FOO*BAR",
      qty: null,
    });
  });

  it("treats a cart with lines as unsaved sale work", () => {
    expect(saleHasUnsavedWork(0)).toBe(false);
    expect(saleHasUnsavedWork(1)).toBe(true);
  });

  it("warns on low, last, and oversold stock without inventing availability", () => {
    expect(stockAvailabilityWarning("15", "1")).toBeNull();
    expect(stockAvailabilityWarning("4", "1")).toBe("Low stock: 4 left");
    expect(stockAvailabilityWarning("2", "2")).toBe("Last 2 units available");
    expect(stockAvailabilityWarning("1", "3")).toBe(
      "Only 1 in stock — reduce quantity or choose another product",
    );
    expect(stockAvailabilityWarning("0", "1")).toBe(
      "Out of stock — this product cannot be sold right now",
    );
    expect(stockAvailabilityWarning(null, "1")).toBeNull();
  });

  it("warns only when an override differs from catalog price", () => {
    expect(priceOverrideWarning(250, 250)).toBeNull();
    expect(priceOverrideWarning(250, 200)).toBe("Catalog 250.00 → 200.00");
  });

  it("adds quantities without going negative", () => {
    expect(addQtyStrings("1", "2")).toBe("3");
    expect(addQtyStrings("1", "-5")).toBe("1");
  });

  it("detects typing targets so global shortcuts do not steal input", () => {
    const input = document.createElement("input");
    const div = document.createElement("div");
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(div)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it("routes cashier keystrokes into product search without stealing quantity keys", () => {
    const event = (key: string, target: EventTarget | null = document.body) =>
      ({ key, target, ctrlKey: false, metaKey: false, altKey: false }) as KeyboardEvent;
    expect(isProductSearchFocusKey(event("L"))).toBe(true);
    expect(isProductSearchFocusKey(event("+"))).toBe(false);
    expect(isProductSearchFocusKey(event("Enter"))).toBe(false);
    const input = document.createElement("input");
    expect(isProductSearchFocusKey(event("L", input))).toBe(false);
    input.value = "LE";
    document.body.appendChild(input);
    appendCharToSearchInput(input, "D");
    expect(input.value).toBe("LED");
    input.remove();
  });

  it("standardizes F1–F8 cashier keys without capturing browser chords", () => {
    expect(POS_SHORTCUTS.map((row) => `${row.key} ${row.label}`)).toEqual([
      "F1 New Sale",
      "F2 Hold / Resume",
      "F3 Customers",
      "F4 Price Override",
      "F5 Discount",
      "F6 Payment",
      "F7 Clear Cart",
      "F8 Cancel Sale",
    ]);
    const event = (key: string, extra: Partial<KeyboardEvent> = {}) =>
      ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...extra }) as KeyboardEvent;
    expect(matchPosFunctionShortcut(event("F1"))).toBe("new-sale");
    expect(matchPosFunctionShortcut(event("F2"))).toBe("hold-resume");
    expect(matchPosFunctionShortcut(event("F3"))).toBe("customers");
    expect(matchPosFunctionShortcut(event("F4"))).toBe("price-override");
    expect(matchPosFunctionShortcut(event("F5"))).toBe("discount");
    expect(matchPosFunctionShortcut(event("F6"))).toBe("payment");
    expect(matchPosFunctionShortcut(event("F7"))).toBe("clear-cart");
    expect(matchPosFunctionShortcut(event("F8"))).toBe("cancel-sale");
    expect(matchPosFunctionShortcut(event("F1", { altKey: true }))).toBeNull();
    expect(matchPosFunctionShortcut(event("F5", { ctrlKey: true }))).toBeNull();
    expect(isReservedBrowserChord(event("r", { ctrlKey: true }))).toBe(true);
    expect(posShortcutFallbackPath("new-sale")).toBe("/pos");
    expect(posShortcutFallbackPath("hold-resume")).toBe("/pos/resume-sale");
    expect(posShortcutFallbackPath("customers")).toBe("/pos/customer-selection");
    expect(posShortcutFallbackPath("discount")).toBe("/pos?focus=discount");
    expect(posShortcutFallbackPath("payment")).toBe("/pos?focus=payment");
    expect(posShortcutFallbackPath("clear-cart")).toBeNull();
    const input = document.createElement("input");
    document.body.appendChild(input);
    const typingEvent = { key: "F2", target: input, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false } as unknown as KeyboardEvent;
    const idleEvent = { key: "F2", target: document.body, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false } as unknown as KeyboardEvent;
    // F2 Hold stays available while searching (industrial cashier habit).
    expect(resolvePosFunctionShortcut(typingEvent)).toBe("hold-resume");
    expect(resolvePosFunctionShortcut(idleEvent)).toBe("hold-resume");
    const typingF5 = { key: "F5", target: input, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false } as unknown as KeyboardEvent;
    expect(resolvePosFunctionShortcut(typingF5)).toBe("discount");
    const typingF4 = { key: "F4", target: input, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false } as unknown as KeyboardEvent;
    expect(resolvePosFunctionShortcut(typingF4)).toBeNull();
    input.remove();
    const button = document.createElement("button");
    expect(isActionTarget(button)).toBe(true);
    expect(isActionTarget(document.createElement("div"))).toBe(false);
    const received: string[] = [];
    const onShortcut = (ev: Event) => {
      received.push((ev as CustomEvent).detail);
      ev.preventDefault();
    };
    window.addEventListener(POS_SHORTCUT_EVENT, onShortcut);
    expect(dispatchPosShortcut("new-sale")).toBe(true);
    window.removeEventListener(POS_SHORTCUT_EVENT, onShortcut);
    expect(received).toEqual(["new-sale"]);
    const qty = document.createElement("input");
    qty.setAttribute("data-pos-cart-qty", "1");
    document.body.appendChild(qty);
    moveCartQtyFocus(0, 1);
    expect(document.activeElement).toBe(qty);
    qty.remove();
  });
});
