import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PosSaleLayout } from "./components/PosSaleLayout";

afterEach(() => {
  cleanup();
});

function layout(chrome: "sheets" | "stack" | "split") {
  return render(
    <PosSaleLayout
      chrome={chrome}
      cartCount={2}
      grandTotal={150}
      customerLabel="Walk-in"
      canPay
      mobileSheet={null}
      onMobileSheet={() => undefined}
      onCancelSale={() => undefined}
      product={<div>Products</div>}
      customer={<div>Customer panel</div>}
      cart={<div>Cart panel</div>}
      payment={<div>Payment panel</div>}
    />,
  );
}

describe("PosSaleLayout chrome", () => {
  it("keeps Pay reachable on the mobile dock without clipping long customer names", () => {
    layout("sheets");
    const customer = screen.getByRole("button", { name: "Walk-in" });
    expect(customer.className).toContain("min-w-0");
    expect(screen.getByRole("button", { name: "Pay" })).toBeEnabled();
  });

  it("stacks product and cart on portrait tablet without hiding the cart", () => {
    const { container } = layout("stack");
    expect(container.firstChild).toHaveClass("pos-sale-grid", "pos-sale-grid--stack");
    expect(screen.queryByRole("navigation", { name: "Mobile POS actions" })).not.toBeInTheDocument();
    expect(screen.getByText("Cart panel")).toBeInTheDocument();
    expect(screen.getByText("Payment panel")).toBeInTheDocument();
  });

  it("keeps a two-zone terminal from the wide-tablet split", () => {
    const { container } = layout("split");
    expect(container.firstChild).toHaveClass("pos-sale-grid");
    expect(container.firstChild).not.toHaveClass("pos-sale-grid--stack");
    expect(screen.queryByRole("navigation", { name: "Mobile POS actions" })).not.toBeInTheDocument();
  });
});
