import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Breadcrumb, DataTable, FilterBar, Input, shouldUseMobileTableCards } from "@electronic-erp/ui";

afterEach(() => {
  cleanup();
});

const tokens = readFileSync(resolve(process.cwd(), "../../packages/ui/src/styles.css"), "utf8");

describe("ERP design tokens", () => {
  it("locks the enterprise blue / white / navy palette and density tokens", () => {
    expect(tokens).toContain("--erp-brand: #1877f2");
    expect(tokens).toContain("--erp-surface: #ffffff");
    expect(tokens).toContain("--erp-bg: #f4f6f9");
    expect(tokens).toContain("--erp-ink: #1a2332");
    expect(tokens).toContain("--erp-navy: #0f1b33");
    expect(tokens).toContain("--erp-radius: 6px");
    expect(tokens).toContain("--erp-control-height: 2.25rem");
    expect(tokens).toContain("--erp-touch-min: 2.75rem");
    expect(tokens).toContain(".erp-table-scroll");
    expect(tokens).toContain(".erp-app table");
    expect(tokens).not.toContain("linear-gradient");
  });
});

describe("DataTable", () => {
  const rows = [
    { id: "1", name: "Cable", qty: 12, status: "Live" },
    { id: "2", name: "Breaker", qty: 3, status: "Hold" },
    { id: "3", name: "Switch", qty: 8, status: "Live" },
  ];

  it("sorts, filters, paginates, hides columns, and keeps row actions", () => {
    render(
      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        searchable
        pageSize={2}
        columnVisibility
        rowActions={(row) => <button type="button">Edit {row.name}</button>}
        columns={[
          {
            key: "name",
            header: "Name",
            sortValue: (row) => row.name,
            filterValue: (row) => row.name,
            cell: (row) => row.name,
          },
          {
            key: "qty",
            header: "Qty",
            sortValue: (row) => row.qty,
            cell: (row) => row.qty,
          },
          {
            key: "status",
            header: "Status",
            filterValue: (row) => row.status,
            cell: (row) => row.status,
          },
        ]}
      />,
    );

    expect(within(screen.getByRole("table")).getByText("Cable")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Breaker")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).queryByText("Switch")).not.toBeInTheDocument();
    expect(screen.getByText("1–2 of 3")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByRole("button", { name: "Edit Cable" })).toBeInTheDocument();
    expect(document.querySelector("[data-erp-table-cards]")).toBeTruthy();
    expect(shouldUseMobileTableCards(3)).toBe(true);
    expect(shouldUseMobileTableCards(7)).toBe(false);
    expect(shouldUseMobileTableCards(3, "table")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /Name/ }));
    const body = screen.getAllByRole("row");
    expect(body[1]).toHaveTextContent("Breaker");

    fireEvent.change(screen.getByRole("searchbox", { name: "Filter rows" }), {
      target: { value: "switch" },
    });
    expect(within(screen.getByRole("table")).getByText("Switch")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).queryByText("Cable")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Columns" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide Qty" }));
    expect(screen.queryByRole("columnheader", { name: /Qty/ })).not.toBeInTheDocument();
  });
});

describe("shared chrome primitives", () => {
  it("renders breadcrumb and filter bar without decorative layout", () => {
    render(
      <>
        <Breadcrumb items={[{ label: "Electronic ERP" }, { label: "INVENTORY" }, { label: "Balances" }]} />
        <FilterBar>
          <Input aria-label="Warehouse" />
        </FilterBar>
      </>,
    );
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("INVENTORY");
    expect(screen.getByRole("textbox", { name: "Warehouse" })).toBeInTheDocument();
  });
});
