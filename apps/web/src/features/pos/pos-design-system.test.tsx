import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { POSSection } from "./design-system/POSSection";
import { POSTabs } from "./design-system/POSTabs";
import { POSModal } from "./design-system/POSModal";
import { POSConfirmDialog } from "./design-system/POSConfirmDialog";
import { POSErrorState } from "./design-system/POSErrorState";
import { POSButton } from "./design-system/POSButton";
import { POSSearch } from "./design-system/POSSearch";
import { POSTable, POSTableHead, POSTh } from "./design-system/POSTable";

const tokens = readFileSync(resolve(process.cwd(), "src/features/pos/pos-tokens.css"), "utf8");

afterEach(() => {
  cleanup();
});

describe("POS design tokens", () => {
  it("defines the locked white + professional blue token names", () => {
    for (const name of [
      "--pos-primary",
      "--pos-primary-hover",
      "--pos-primary-active",
      "--pos-primary-soft",
      "--pos-hover",
      "--pos-active",
      "--pos-light",
      "--pos-workspace",
      "--pos-bg",
      "--pos-border",
      "--pos-ink",
      "--pos-muted",
      "--pos-navy",
      "--pos-nav-bg",
      "--pos-nav-ink",
      "--pos-nav-active-bg",
      "--pos-success",
      "--pos-warning",
      "--pos-danger",
      "--pos-text-md",
      "--pos-space-2",
      "--pos-radius",
      "--pos-shadow",
      "--pos-control-height",
      "--pos-header-height",
      "--pos-sidebar-width",
    ]) {
      expect(tokens).toContain(name);
    }
    expect(tokens).toContain("--pos-primary: #1877f2");
    expect(tokens).toContain("--pos-workspace: #ffffff");
    expect(tokens).toContain("--pos-navy: #0f1b33");
    expect(tokens).toContain("--pos-bg: #f4f6f9");
    expect(tokens).toContain("var(--erp-font)");
    expect(tokens).toContain(":focus-within");
    expect(tokens).toContain(".pos-nav-link:focus-visible");
    expect(tokens).toContain(".pos-nav-active");
    expect(tokens).toContain(".pos-input-base");
    expect(tokens).toContain(".pos-data-table");
    expect(tokens).toContain(".pos-cta");
    expect(tokens).toContain(".pos-sales-workspace");
    expect(tokens).toContain(".pos-ops-workspace");
    expect(tokens).toContain(".pos-sale-grid--stack");
    expect(tokens).toContain(".pos-split-register");
    expect(tokens).toContain("@media (max-width: 767px)");
    expect(tokens).toContain("@media (max-width: 1023px) and (min-width: 768px)");
    expect(tokens).toContain("@media (min-width: 1024px)");
  });
});

describe("POS design primitives", () => {
  it("applies locked button, search, and table classes", () => {
    render(
      <>
        <POSButton>Pay now</POSButton>
        <POSSearch aria-label="Search products" />
        <POSTable>
          <POSTableHead>
            <tr>
              <POSTh>Product</POSTh>
            </tr>
          </POSTableHead>
        </POSTable>
      </>,
    );
    expect(screen.getByRole("button", { name: "Pay now" }).className).toContain("pos-cta");
    expect(screen.getByRole("searchbox", { name: "Search products" }).className).toContain("pos-search-input");
    expect(screen.getByRole("table").className).toContain("pos-data-table");
  });

  it("keeps compact register search at control height", () => {
    render(<POSSearch compact aria-label="Register search" />);
    expect(screen.getByRole("searchbox", { name: "Register search" }).className).not.toContain("pos-search-input");
  });

  it("renders section headings and underline tabs", () => {
    function TabsProbe() {
      return <POSTabs items={[{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }]} value="a" onChange={() => undefined} />;
    }
    render(
      <>
        <POSSection title="Cart" description="Lines">
          body
        </POSSection>
        <TabsProbe />
      </>,
    );
    expect(screen.getByRole("heading", { name: "Cart" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("aria-selected", "false");
  });

  it("closes a POS modal on Escape", () => {
    const onClose = vi.fn();
    render(
      <POSModal open title="Held sales" onClose={onClose}>
        body
      </POSModal>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("confirms a POS dialog on Enter and moves tabs with arrows", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    function TabsProbe() {
      const [value, setValue] = useState("a");
      return <POSTabs items={[{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }]} value={value} onChange={setValue} />;
    }
    render(
      <>
        <POSConfirmDialog open title="Clear cart?" description="Remove lines" onConfirm={onConfirm} onCancel={onCancel} />
        <TabsProbe />
      </>,
    );
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onConfirm).toHaveBeenCalled();
    const alpha = screen.getByRole("tab", { name: "Alpha" });
    alpha.focus();
    fireEvent.keyDown(alpha, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("aria-selected", "true");
  });

  it("renders a POS error state with retry", () => {
    const onAction = vi.fn();
    render(
      <POSErrorState title="Could not load held sales" description="Network error" onAction={onAction} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load held sales");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onAction).toHaveBeenCalled();
  });
});
