import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@electronic-erp/ui";
import { ModulePlaceholderPage } from "@/features/modules/ModulePlaceholderPage";
import { ERP_MODULES } from "@/app/modules";

describe("web foundation", () => {
  it("renders module placeholder", () => {
    const module = ERP_MODULES[0]!;
    render(
      <MemoryRouter>
        <ToastProvider>
          <ModulePlaceholderPage module={module} />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(module.title)).toBeInTheDocument();
    expect(screen.getByText(/Foundation placeholder/i)).toBeInTheDocument();
  });

  it("registers major module routes", () => {
    expect(ERP_MODULES.length).toBeGreaterThanOrEqual(50);
    expect(ERP_MODULES.some((m) => m.path === "/pos")).toBe(true);
    expect(ERP_MODULES.some((m) => m.path === "/hr")).toBe(true);
  });
});
