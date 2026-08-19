import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthContext";
import { AppShell } from "@/app/shell/AppShell";
import { VIEWPORT_MOBILE_QUERY, VIEWPORT_TABLET_QUERY } from "@/app/shell/viewport";

afterEach(() => {
  cleanup();
});

function stubMatchMedia(mode: "mobile" | "tablet" | "desktop") {
  window.matchMedia = ((query: string) => {
    const matches =
      mode === "mobile"
        ? query === VIEWPORT_MOBILE_QUERY
        : mode === "tablet"
          ? query === VIEWPORT_TABLET_QUERY
          : false;
    return {
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    };
  }) as typeof window.matchMedia;
}

function renderShell(path = "/command-center") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="*" element={<div>workspace</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("responsive ERP architecture", () => {
  it("keeps the same 39-module sidebar as a mobile drawer", async () => {
    stubMatchMedia("mobile");
    const { container } = renderShell("/pos");
    await waitFor(() => {
      expect(container.firstElementChild).toHaveAttribute("data-erp-viewport", "mobile");
    });
    expect(container.firstElementChild).toHaveAttribute("data-erp-nav", "drawer");
    expect(container.querySelector("#erp-module-nav")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(container.firstElementChild).toHaveAttribute("data-erp-nav", "drawer-open");
    expect(screen.getByRole("button", { name: "Close navigation" })).toBeInTheDocument();
    const modules = screen.getByLabelText("ERP modules");
    expect(within(modules).getByRole("link", { name: "POS / SALES" })).toHaveAttribute("href", "/pos");
    expect(within(modules).getByRole("link", { name: "COMMAND CENTER" })).toHaveAttribute("href", "/command-center");
    expect(within(modules).queryByRole("link", { name: "Hold / Resume" })).not.toBeInTheDocument();
  });

  it("collapses the same sidebar on tablet instead of opening a second app", async () => {
    stubMatchMedia("tablet");
    const { container } = renderShell("/pos");
    await waitFor(() => {
      expect(container.firstElementChild).toHaveAttribute("data-erp-viewport", "tablet");
      expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
    });
    expect(container.firstElementChild).toHaveAttribute("data-erp-nav", "collapsed");
    expect(container.firstElementChild?.className).toContain("md:grid-cols-[72px_minmax(0,1fr)]");
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(container.firstElementChild).toHaveAttribute("data-erp-nav", "expanded");
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  it("keeps desktop chrome with a visible sidebar and header", async () => {
    stubMatchMedia("desktop");
    const { container } = renderShell("/command-center");
    await waitFor(() => {
      expect(container.firstElementChild).toHaveAttribute("data-erp-viewport", "desktop");
    });
    expect(container.firstElementChild).toHaveAttribute("data-erp-nav", "expanded");
    expect(container.querySelector("[data-erp-chrome='header']")).toBeTruthy();
    expect(container.querySelector("[data-erp-chrome='sidebar']")).toBeTruthy();
    expect(screen.getByRole("link", { name: "POS / SALES" }).className).toContain("min-h-11");
  });
});
