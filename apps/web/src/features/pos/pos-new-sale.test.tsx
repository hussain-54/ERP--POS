import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, act, within } from "@testing-library/react";
import type { ProductSearchResult } from "@electronic-erp/contracts";
import type { PosCustomerProfile } from "@electronic-erp/domain";
import { PosProductPanel } from "./components/PosProductPanel";
import { PosSaleMeta } from "./components/PosSaleMeta";
import { POS_PRODUCT_PAGE_SIZE, POS_PRODUCT_SEARCH_PLACEHOLDER } from "./pos-catalog-load";
import { PosCart } from "./components/PosCart";
import { PosCustomerPanel } from "./components/PosCustomerPanel";
import { PosPaymentPanel } from "./components/PosPaymentPanel";
import { PosTotals } from "./components/PosTotals";
import { toPosTransactionSummary } from "./pos-transaction";
import type { CartLine } from "./pos-types";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const unitId = "11111111-1111-4111-8111-111111111111";
const productId = "33333333-3333-4333-8333-333333333333";

const catalogProduct: ProductSearchResult = {
  productId,
  name: "LED Bulb 12W",
  sku: "LED-12",
  brand: "Philips",
  unitId,
  unitSymbolPlaces: 0,
  retailPrice: 250,
  wholesalePrice: 200,
  dealerPrice: 180,
  warrantyDays: 365,
  stockAvailable: "15",
};

const cartLine: CartLine = {
  key: "line-1",
  productId,
  name: "LED Bulb 12W",
  sku: "LED-12",
  unitId,
  unitName: "pcs",
  qty: "1",
  unitPrice: 250,
  discount: 0,
  tax: 0,
  warrantyDays: 365,
  stock: "15",
};

const customer: PosCustomerProfile = {
  id: "44444444-4444-4444-8444-444444444444",
  code: "C-100",
  name: "Ahmed Traders",
  mobile: "03001234567",
  customerType: "wholesale",
  creditLimit: "50000",
  creditDays: 30,
  outstanding: "12000",
  isBlocked: false,
  loyaltyPoints: 80,
  priceLevel: "wholesale",
};

describe("industrial New Sale terminal", () => {
  it("shows catalog discovery chrome without fake products", () => {
    render(
      <PosProductPanel
        query=""
        onQueryChange={() => undefined}
        searching={false}
        products={[]}
        favorites={[]}
        recent={[]}
        categories={[{ id: "cat-1", name: "Lighting" }]}
        selectedCategoryId={null}
        onSelectCategory={() => undefined}
        favoriteIds={new Set()}
        onToggleFavorite={() => undefined}
        tab="recent"
        onTabChange={() => undefined}
        locale="en"
        priceLevel="retail"
        onAdd={() => undefined}
        searchRef={createRef<HTMLInputElement>()}
      />,
    );
    expect(
      screen.getByPlaceholderText(POS_PRODUCT_SEARCH_PLACEHOLDER),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Barcode Scan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "QR Scan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Camera" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manual Entry" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Recent" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Favorites" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Categories" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Search" })).not.toBeInTheDocument();
    expect(screen.getByText("No recent products")).toBeInTheDocument();
    expect(screen.queryByText(/sample product/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/demo product/i)).not.toBeInTheDocument();
  });

  it("keeps warehouse, mode, and language in compact sale settings", () => {
    const onWarehouse = vi.fn();
    render(
      <PosSaleMeta
        warehouseId="w1"
        warehouses={[{ id: "w1", name: "Main warehouse" }]}
        lastInvoice="INV-9"
        mode="easy"
        locale="en"
        onWarehouse={onWarehouse}
        onMode={() => undefined}
        onLocale={() => undefined}
      />,
    );
    expect(screen.getByLabelText("Sale settings")).toBeInTheDocument();
    expect(screen.getByLabelText("Warehouse")).toHaveValue("w1");
    expect(screen.getByLabelText("Mode")).toHaveValue("easy");
    expect(screen.getByLabelText("Language")).toHaveValue("en");
    expect(screen.getByText("Last INV-9")).toBeInTheDocument();
  });

  it("renders real catalog cards with name, brand, sku, price, stock, and favorite", () => {
    const onAdd = vi.fn();
    const onFav = vi.fn();
    render(
      <PosProductPanel
        query="LED"
        onQueryChange={() => undefined}
        searching={false}
        products={[catalogProduct]}
        favorites={[]}
        recent={[]}
        categories={[]}
        selectedCategoryId={null}
        onSelectCategory={() => undefined}
        favoriteIds={new Set([productId])}
        onToggleFavorite={onFav}
        tab="recent"
        onTabChange={() => undefined}
        locale="en"
        priceLevel="retail"
        onAdd={onAdd}
        searchRef={createRef<HTMLInputElement>()}
      />,
    );
    expect(screen.getByText("LED Bulb 12W")).toBeInTheDocument();
    expect(screen.getByText("Philips")).toBeInTheDocument();
    expect(screen.getByText("SKU LED-12")).toBeInTheDocument();
    expect(screen.getByText("Rs 250.00")).toBeInTheDocument();
    expect(screen.getByText("Stock 15")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove favorite" }));
    expect(onFav).toHaveBeenCalled();
    fireEvent.click(screen.getByText("LED Bulb 12W"));
    expect(onAdd).toHaveBeenCalledWith(catalogProduct);
  });

  it("commits search on Enter and clears the query on Escape", () => {
    const onCommit = vi.fn();
    const onQueryChange = vi.fn();
    render(
      <PosProductPanel
        query="LED-12"
        onQueryChange={onQueryChange}
        searching={false}
        products={[catalogProduct]}
        favorites={[]}
        recent={[]}
        categories={[]}
        selectedCategoryId={null}
        onSelectCategory={() => undefined}
        favoriteIds={new Set()}
        onToggleFavorite={() => undefined}
        tab="recent"
        onTabChange={() => undefined}
        locale="en"
        priceLevel="retail"
        onAdd={() => undefined}
        onCommitSearch={onCommit}
        searchRef={createRef<HTMLInputElement>()}
      />,
    );
    const search = screen.getByPlaceholderText(POS_PRODUCT_SEARCH_PLACEHOLDER);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith("LED-12", catalogProduct);
    fireEvent.keyDown(search, { key: "Escape" });
    expect(onQueryChange).toHaveBeenCalledWith("");
  });

  it("does not flush product search to the parent on every keystroke", () => {
    vi.useFakeTimers();
    const onQueryChange = vi.fn();
    render(
      <PosProductPanel
        query=""
        onQueryChange={onQueryChange}
        searching={false}
        products={[]}
        favorites={[]}
        recent={[]}
        categories={[]}
        selectedCategoryId={null}
        onSelectCategory={() => undefined}
        favoriteIds={new Set()}
        onToggleFavorite={() => undefined}
        tab="recent"
        onTabChange={() => undefined}
        locale="en"
        priceLevel="retail"
        onAdd={() => undefined}
        searchRef={createRef<HTMLInputElement>()}
      />,
    );
    fireEvent.change(
      screen.getByPlaceholderText(POS_PRODUCT_SEARCH_PLACEHOLDER),
      { target: { value: "LED" } },
    );
    expect(onQueryChange).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onQueryChange).toHaveBeenCalledWith("LED");
    vi.useRealTimers();
  });

  it("keeps a paged 3-column product grid and View More Products", () => {
    const products = Array.from({ length: POS_PRODUCT_PAGE_SIZE + 1 }, (_, index) => ({
      ...catalogProduct,
      productId: `33333333-3333-4333-8333-1111111111${String(index).padStart(2, "0")}`,
      name: `Item ${index + 1}`,
      sku: `SKU-${index + 1}`,
    }));
    render(
      <PosProductPanel
        query="item"
        onQueryChange={() => undefined}
        searching={false}
        products={products}
        favorites={[]}
        recent={[]}
        categories={[]}
        selectedCategoryId={null}
        onSelectCategory={() => undefined}
        favoriteIds={new Set()}
        onToggleFavorite={() => undefined}
        tab="recent"
        onTabChange={() => undefined}
        locale="en"
        priceLevel="retail"
        onAdd={() => undefined}
        searchRef={createRef<HTMLInputElement>()}
      />,
    );
    expect(document.querySelector(".pos-product-grid")).toBeTruthy();
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText(`Item ${POS_PRODUCT_PAGE_SIZE}`)).toBeInTheDocument();
    expect(screen.queryByText(`Item ${POS_PRODUCT_PAGE_SIZE + 1}`)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View More Products" }));
    expect(screen.getByText(`Item ${POS_PRODUCT_PAGE_SIZE + 1}`)).toBeInTheDocument();
  });

  it("supports cart quantity, discount, tax, total, and remove", () => {
    const onQty = vi.fn();
    const onIncrease = vi.fn();
    const onDecrease = vi.fn();
    const onRemove = vi.fn();
    const onDiscount = vi.fn();
    render(
      <PosCart
        cart={[{ ...cartLine, qty: "2", discount: 10, tax: 17, unitPrice: 250 }]}
        locale="en"
        onQty={onQty}
        onIncrease={onIncrease}
        onDecrease={onDecrease}
        onPrice={() => undefined}
        onDiscount={onDiscount}
        onUnitChange={() => undefined}
        onRemove={onRemove}
        onClear={() => undefined}
        onManual={() => undefined}
        canDiscount
        canPriceOverride
      />,
    );
    expect(screen.getByText("#")).toBeInTheDocument();
    expect(screen.getByText("Product")).toBeInTheDocument();
    expect(screen.getByText("Qty")).toBeInTheDocument();
    expect(screen.getByText("Unit")).toBeInTheDocument();
    expect(screen.getByText("Rate")).toBeInTheDocument();
    expect(screen.getByText("Discount")).toBeInTheDocument();
    expect(screen.getByText("Tax")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("LED-12 · Stock 15")).toBeInTheDocument();
    expect(screen.getByText("507.00")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "CART (1 ITEM)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply Discount" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear Cart" })).toBeEnabled();
    fireEvent.click(screen.getByLabelText("Increase quantity"));
    fireEvent.click(screen.getByLabelText("Decrease quantity"));
    fireEvent.change(screen.getByLabelText("Quantity for LED Bulb 12W"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Discount for LED Bulb 12W"), {
      target: { value: "15" },
    });
    fireEvent.click(screen.getByLabelText("Remove item"));
    expect(onIncrease).toHaveBeenCalledWith("line-1");
    expect(onDecrease).toHaveBeenCalledWith("line-1");
    expect(onQty).toHaveBeenCalledWith("line-1", "3");
    expect(onDiscount).toHaveBeenCalledWith("line-1", "15");
    expect(onRemove).toHaveBeenCalledWith("line-1");
  });

  it("puts Apply Discount on the cart header and keeps invoice discount state", () => {
    const onInvoiceDiscount = vi.fn();
    const discountRef = createRef<HTMLInputElement>();
    render(
      <PosCart
        cart={[cartLine]}
        locale="en"
        onQty={() => undefined}
        onIncrease={() => undefined}
        onDecrease={() => undefined}
        onPrice={() => undefined}
        onDiscount={() => undefined}
        onUnitChange={() => undefined}
        onRemove={() => undefined}
        onClear={() => undefined}
        canDiscount
        canPriceOverride={false}
        invoiceDiscount="10"
        onInvoiceDiscount={onInvoiceDiscount}
        discountRef={discountRef}
        canInvoiceDiscount
      />,
    );
    expect(screen.getByRole("heading", { name: "CART (1 ITEM)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply Discount" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Clear Cart" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Invoice discount"), { target: { value: "15" } });
    expect(onInvoiceDiscount).toHaveBeenCalledWith("15");
  });

  it("warns on last units and ignores negative quantity input", () => {
    const onQty = vi.fn();
    render(
      <PosCart
        cart={[{ ...cartLine, qty: "2", stock: "2" }]}
        locale="en"
        onQty={onQty}
        onIncrease={() => undefined}
        onDecrease={() => undefined}
        onPrice={() => undefined}
        onDiscount={() => undefined}
        onUnitChange={() => undefined}
        onRemove={() => undefined}
        onClear={() => undefined}
        onManual={() => undefined}
        canDiscount={false}
        canPriceOverride={false}
      />,
    );
    expect(screen.getByText("Last available units")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("2"), {
      target: { value: "-1" },
    });
    expect(onQty).not.toHaveBeenCalled();
  });

  it("shows real customer price tier, credit, outstanding, and loyalty", () => {
    render(
      <PosCustomerPanel
        customer={customer}
        walkIn={false}
        customers={[]}
        customerQuery=""
        onCustomerQuery={() => undefined}
        onSelectCustomer={() => undefined}
        onWalkIn={() => undefined}
        canCreate={false}
        canEdit={false}
        canRead
        priceLevel="wholesale"
        onPriceLevel={() => undefined}
        salesmanId=""
        salesmen={[]}
        onSalesman={() => undefined}
        referenceId=""
        references={[]}
        onReference={() => undefined}
        delivery={false}
        onDelivery={() => undefined}
        customerRef={createRef<HTMLInputElement>()}
        advanced={false}
      />,
    );
    expect(screen.getByRole("button", { name: "New Customer" })).toBeInTheDocument();
    expect(screen.getByText("Price Tier")).toBeInTheDocument();
    expect(screen.getAllByText("Wholesale").length).toBeGreaterThan(0);
    expect(screen.getByText("Credit Limit")).toBeInTheDocument();
    expect(screen.getByText("50000.00")).toBeInTheDocument();
    expect(screen.getByText("Outstanding")).toBeInTheDocument();
    expect(screen.getByText("12000.00")).toBeInTheDocument();
    expect(screen.getByText("Loyalty Points")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.queryByText(customer.id)).not.toBeInTheDocument();
  });

  it("selects a searched customer and keeps walk-in", () => {
    const onSelectCustomer = vi.fn();
    const onWalkIn = vi.fn();
    render(
      <PosCustomerPanel
        customer={null}
        walkIn={false}
        customers={[
          {
            id: customer.id,
            code: customer.code,
            name: customer.name,
            mobile: customer.mobile,
            customerType: "wholesale",
          },
        ]}
        customerQuery="Ahmed"
        onCustomerQuery={() => undefined}
        onSelectCustomer={onSelectCustomer}
        onWalkIn={onWalkIn}
        canCreate
        canEdit={false}
        canRead
        priceLevel="retail"
        onPriceLevel={() => undefined}
        salesmanId=""
        salesmen={[]}
        onSalesman={() => undefined}
        referenceId=""
        references={[]}
        onReference={() => undefined}
        delivery={false}
        onDelivery={() => undefined}
        customerRef={createRef<HTMLInputElement>()}
        advanced={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Ahmed Traders/ }));
    expect(onSelectCustomer).toHaveBeenCalledWith(customer.id);
    fireEvent.click(screen.getByRole("button", { name: "Walk-in" }));
    expect(onWalkIn).toHaveBeenCalled();
  });

  it("renders mapped session totals without a second grand calculation", () => {
    const summary = toPosTransactionSummary({
      items: 1,
      qty: 2,
      subtotal: 500,
      itemDiscount: 10,
      invoiceDiscount: 5,
      discount: 15,
      tax: 83.3,
      grand: 568.3,
      taxInvoice: { taxableAmount: 490, taxTotal: 83.3 },
    });
    render(<PosTotals summary={summary} />);
    expect(screen.getByText("Total Items")).toBeInTheDocument();
    expect(screen.getByText("Item Discount")).toBeInTheDocument();
    expect(screen.getByText("−10.00")).toBeInTheDocument();
    expect(screen.getByText("Taxable Amount")).toBeInTheDocument();
    expect(screen.getByText("Sales Tax")).toBeInTheDocument();
    expect(screen.getByText("GRAND TOTAL")).toBeInTheDocument();
    expect(screen.getByText("Rs 568.30")).toBeInTheDocument();
    expect(document.querySelector("[data-grand='568.30']")).toBeTruthy();
  });

  it("does not flush customer search to the parent on every keystroke", () => {
    vi.useFakeTimers();
    const onCustomerQuery = vi.fn();
    render(
      <PosCustomerPanel
        customer={null}
        walkIn={false}
        customers={[]}
        customerQuery=""
        onCustomerQuery={onCustomerQuery}
        onSelectCustomer={() => undefined}
        onWalkIn={() => undefined}
        canCreate={false}
        canEdit={false}
        canRead
        priceLevel="retail"
        onPriceLevel={() => undefined}
        salesmanId=""
        salesmen={[]}
        onSalesman={() => undefined}
        referenceId=""
        references={[]}
        onReference={() => undefined}
        delivery={false}
        onDelivery={() => undefined}
        customerRef={createRef<HTMLInputElement>()}
        advanced={false}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Name, mobile, or code…"), {
      target: { value: "Ahmed" },
    });
    expect(onCustomerQuery).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onCustomerQuery).toHaveBeenCalledWith("Ahmed");
    vi.useRealTimers();
  });

  it("shows configured payment methods only and keeps grand total plus pay now", () => {
    render(
      <PosPaymentPanel
        totals={{
          items: 1,
          qty: 2,
          subtotal: 500,
          itemDiscount: 0,
          invoiceDiscount: 10,
          discount: 10,
          tax: 83.3,
          grand: 573.3,
          taxInvoice: { taxableAmount: 490, taxTotal: 83.3 },
        }}
        invoiceDiscount="10"
        onInvoiceDiscount={() => undefined}
        canInvoiceDiscount
        discountRef={createRef<HTMLInputElement>()}
        methods={[
          { id: "m-cash", name: "Cash", kind: "cash" },
          { id: "m-jazz", name: "JazzCash", kind: "wallet" },
        ]}
        payments={[{ id: "p1", paymentMethodId: "m-cash", amount: "573.3", methodKind: "cash" }]}
        onPayments={() => undefined}
        notes=""
        onNotes={() => undefined}
        busy={false}
        canPay
        allowCreditDue={false}
        onHold={() => undefined}
        onPay={() => undefined}
        onQuotation={() => undefined}
        canQuote
        advanced={false}
        useInstallment={false}
        onUseInstallment={() => undefined}
        installmentCount="3"
        onInstallmentCount={() => undefined}
        downPayment="0"
        onDownPayment={() => undefined}
        installmentFrequency="monthly"
        onInstallmentFrequency={() => undefined}
        lateFeePercent="0"
        onLateFeePercent={() => undefined}
        lateFeeFixed="0"
        onLateFeeFixed={() => undefined}
        isAdvance={false}
        onIsAdvance={() => undefined}
        cashReceived=""
        onCashReceived={() => undefined}
      />,
    );
    expect(screen.getByText("Total Items")).toBeInTheDocument();
    expect(screen.getByText("Total Quantity")).toBeInTheDocument();
    expect(screen.getByText("Subtotal")).toBeInTheDocument();
    expect(screen.getByText("Item Discount")).toBeInTheDocument();
    expect(screen.getByText("Invoice Discount")).toBeInTheDocument();
    expect(screen.getByText("Total Discount")).toBeInTheDocument();
    expect(screen.getByText("Taxable Amount")).toBeInTheDocument();
    expect(screen.getByText("Sales Tax")).toBeInTheDocument();
    expect(screen.getByText("Delivery Charges")).toBeInTheDocument();
    expect(screen.getByText("Round Off")).toBeInTheDocument();
    expect(screen.getByText("GRAND TOTAL")).toBeInTheDocument();
    expect(screen.getByText("Rs 573.30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cash" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "JazzCash" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "SadaPay" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Easypaisa" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PAY NOW" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "HOLD SALE" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "QUOTATION" })).toBeInTheDocument();
  });

  it("blocks PAY NOW while pending and hides invoice discount without permission", () => {
    const onPay = vi.fn();
    render(
      <PosPaymentPanel
        totals={{
          items: 1,
          qty: 1,
          subtotal: 100,
          itemDiscount: 0,
          invoiceDiscount: 0,
          discount: 0,
          tax: 0,
          grand: 100,
        }}
        invoiceDiscount="0"
        onInvoiceDiscount={() => undefined}
        canInvoiceDiscount={false}
        discountRef={createRef<HTMLInputElement>()}
        methods={[{ id: "m-cash", name: "Cash", kind: "cash" }]}
        payments={[{ id: "p1", paymentMethodId: "m-cash", amount: "100", methodKind: "cash" }]}
        onPayments={() => undefined}
        notes=""
        onNotes={() => undefined}
        busy
        canPay
        allowCreditDue={false}
        onHold={() => undefined}
        onPay={onPay}
        advanced={false}
        useInstallment={false}
        onUseInstallment={() => undefined}
        installmentCount="3"
        onInstallmentCount={() => undefined}
        downPayment="0"
        onDownPayment={() => undefined}
        installmentFrequency="monthly"
        onInstallmentFrequency={() => undefined}
        lateFeePercent="0"
        onLateFeePercent={() => undefined}
        lateFeeFixed="0"
        onLateFeeFixed={() => undefined}
        isAdvance={false}
        onIsAdvance={() => undefined}
        cashReceived=""
        onCashReceived={() => undefined}
        confirmation="pending"
      />,
    );
    expect(screen.getByText("Invoice discount requires a POS discount permission")).toBeInTheDocument();
    const pay = screen.getByRole("button", { name: "Loading…" });
    expect(pay).toBeDisabled();
    expect(pay).toHaveAttribute("aria-busy", "true");
    fireEvent.click(pay);
    expect(onPay).not.toHaveBeenCalled();
  });

  it("disables hold and installment when those permissions are missing", () => {
    render(
      <PosPaymentPanel
        totals={{
          items: 1,
          qty: 1,
          subtotal: 100,
          discount: 0,
          tax: 0,
          grand: 100,
        }}
        invoiceDiscount="0"
        onInvoiceDiscount={() => undefined}
        canInvoiceDiscount={false}
        discountRef={createRef<HTMLInputElement>()}
        methods={[{ id: "m-cash", name: "Cash", kind: "cash" }]}
        payments={[{ id: "p1", paymentMethodId: "m-cash", amount: "100", methodKind: "cash" }]}
        onPayments={() => undefined}
        notes=""
        onNotes={() => undefined}
        busy={false}
        canPay
        allowCreditDue
        canHold={false}
        canInstallment={false}
        onHold={() => undefined}
        onPay={() => undefined}
        advanced
        useInstallment={false}
        onUseInstallment={() => undefined}
        installmentCount="3"
        onInstallmentCount={() => undefined}
        downPayment="0"
        onDownPayment={() => undefined}
        installmentFrequency="monthly"
        onInstallmentFrequency={() => undefined}
        lateFeePercent="0"
        onLateFeePercent={() => undefined}
        lateFeeFixed="0"
        onLateFeeFixed={() => undefined}
        isAdvance={false}
        onIsAdvance={() => undefined}
        cashReceived=""
        onCashReceived={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "HOLD SALE" })).toBeDisabled();
    expect(screen.getByLabelText("Create installment plan")).toBeDisabled();
  });

  it("selects JazzCash as a record-only tender without posting", () => {
    const onPayments = vi.fn();
    const onPay = vi.fn();
    render(
      <PosPaymentPanel
        totals={{
          items: 1,
          qty: 1,
          subtotal: 100,
          itemDiscount: 0,
          invoiceDiscount: 0,
          discount: 0,
          tax: 0,
          grand: 100,
        }}
        invoiceDiscount="0"
        onInvoiceDiscount={() => undefined}
        canInvoiceDiscount={false}
        discountRef={createRef<HTMLInputElement>()}
        methods={[
          { id: "m-cash", name: "Cash", kind: "cash" },
          { id: "m-jazz", name: "JazzCash", kind: "jazzcash" },
        ]}
        payments={[{ id: "p1", paymentMethodId: "m-jazz", amount: "100", methodKind: "jazzcash" }]}
        onPayments={onPayments}
        notes=""
        onNotes={() => undefined}
        busy={false}
        canPay
        allowCreditDue={false}
        onHold={() => undefined}
        onPay={onPay}
        advanced={false}
        useInstallment={false}
        onUseInstallment={() => undefined}
        installmentCount="3"
        onInstallmentCount={() => undefined}
        downPayment="0"
        onDownPayment={() => undefined}
        installmentFrequency="monthly"
        onInstallmentFrequency={() => undefined}
        lateFeePercent="0"
        onLateFeePercent={() => undefined}
        lateFeeFixed="0"
        onLateFeeFixed={() => undefined}
        isAdvance={false}
        onIsAdvance={() => undefined}
        cashReceived="100"
        onCashReceived={() => undefined}
      />,
    );
    expect(screen.getByText("Recorded locally — no gateway settlement")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "JazzCash" }));
    expect(onPayments).toHaveBeenCalledWith([
      expect.objectContaining({ paymentMethodId: "m-jazz", methodKind: "jazzcash", amount: "100" }),
    ]);
    expect(onPay).not.toHaveBeenCalled();
  });

  it("opens a confirmation modal from PAY NOW and posts only after confirm", () => {
    const onPay = vi.fn();
    render(
      <PosPaymentPanel
        totals={{
          items: 1,
          qty: 1,
          subtotal: 100,
          itemDiscount: 0,
          invoiceDiscount: 0,
          discount: 0,
          tax: 0,
          grand: 100,
          taxInvoice: { taxableAmount: 100, taxTotal: 0 },
        }}
        invoiceDiscount="0"
        onInvoiceDiscount={() => undefined}
        canInvoiceDiscount={false}
        discountRef={createRef<HTMLInputElement>()}
        methods={[{ id: "m-cash", name: "Cash", kind: "cash" }]}
        payments={[{ id: "p1", paymentMethodId: "m-cash", amount: "100", methodKind: "cash" }]}
        onPayments={() => undefined}
        notes=""
        onNotes={() => undefined}
        busy={false}
        canPay
        allowCreditDue={false}
        onHold={() => undefined}
        onPay={onPay}
        advanced={false}
        useInstallment={false}
        onUseInstallment={() => undefined}
        installmentCount="3"
        onInstallmentCount={() => undefined}
        downPayment="0"
        onDownPayment={() => undefined}
        installmentFrequency="monthly"
        onInstallmentFrequency={() => undefined}
        lateFeePercent="0"
        onLateFeePercent={() => undefined}
        lateFeeFixed="0"
        onLateFeeFixed={() => undefined}
        isAdvance={false}
        onIsAdvance={() => undefined}
        cashReceived="100"
        onCashReceived={() => undefined}
        customer={null}
        walkIn
        invoiceReference={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "PAY NOW" }));
    expect(onPay).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Confirm payment" });
    expect(within(dialog).getByText("Customer")).toBeInTheDocument();
    expect(within(dialog).getByText("Invoice / reference")).toBeInTheDocument();
    expect(within(dialog).getByText("Payment method")).toBeInTheDocument();
    expect(within(dialog).getByText("Amount due")).toBeInTheDocument();
    expect(within(dialog).getByText("Change")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "PAY NOW" }));
    expect(onPay).toHaveBeenCalledTimes(1);
  });
});
