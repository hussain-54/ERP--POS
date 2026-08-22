import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { POS_OWNERSHIP } from "./pos-ownership";
import { PosCustomersPage, PosProductsPage, PosReportsPage, POS_REPORT_LINKS } from "./PosHubPages";

describe("POS hub pages", () => {
  it("keeps Customers and Products as honest Open POS shortcuts", () => {
    const { unmount } = render(
      <MemoryRouter>
        <PosCustomersPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Customers" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open POS" })).toBeInTheDocument();
    expect(screen.getByText(/ERP Customers module is unchanged/)).toBeInTheDocument();
    unmount();

    render(
      <MemoryRouter>
        <PosProductsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Products" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open POS" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create product" })).toBeInTheDocument();
    expect(screen.getByText(/does not load the full catalog/)).toBeInTheDocument();
  });

  it("launches live POS registers from Reports without inventing ERP report screens", () => {
    render(
      <MemoryRouter>
        <PosReportsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
    expect(screen.getByText(/not a second ERP reports module/)).toBeInTheDocument();
    expect(POS_REPORT_LINKS.map((item) => item.path)).toEqual(POS_OWNERSHIP.map((item) => item.canonical));
    expect(POS_REPORT_LINKS).toHaveLength(26);
    for (const item of POS_REPORT_LINKS) {
      expect(screen.getByText(item.title)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button", { name: "Open" })).toHaveLength(POS_REPORT_LINKS.length);
  });
});
