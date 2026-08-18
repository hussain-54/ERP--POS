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
    ]) {
      expect(tokens).toContain(name);
    }
    expect(tokens).toContain("var(--erp-brand)");
    expect(tokens).toContain("var(--erp-surface)");
    expect(tokens).toContain(":focus-within");
    expect(tokens).toContain(".pos-nav-link:focus-visible");
    expect(tokens).toContain(".pos-nav-active");
  });
});

describe("POS design primitives", () => {
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
