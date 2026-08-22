import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PosCustomersPage, PosProductsPage, PosReportsPage } from "./PosHubPages";
import { POS_REFERENCE_IA } from "./pos-reference-ia";

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

  it("maps the 15-section POS reference IA to live destinations on Reports", () => {
    render(
      <MemoryRouter>
        <PosReportsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
    expect(screen.getByText(/15 sections/)).toBeInTheDocument();
    expect(POS_REFERENCE_IA).toHaveLength(15);
    expect(POS_REFERENCE_IA[0]?.title).toBe("Overview");
    expect(POS_REFERENCE_IA[14]?.title).toBe("POS Settings");
    expect(screen.getByText("01. Overview")).toBeInTheDocument();
    expect(screen.getByText("15. POS Settings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /POS Terminal/i })).toBeInTheDocument();
  });
});
