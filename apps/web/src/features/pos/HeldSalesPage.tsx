import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { HeldSaleLifecycleView, HeldSaleRecord } from "@electronic-erp/domain";
import { useToast } from "@electronic-erp/ui";
import { useAuth } from "@/features/auth/AuthContext";
import { partiesApi } from "@/features/customers/parties-api";
import { inventoryApi } from "@/features/inventory/inventory-api";
import { adminApi } from "@/features/users/admin-api";
import { posApi } from "./pos-api";
import { canActOnOwnedOrForeignHold } from "./pos-security";
import { usePosLayoutMode } from "./usePosLayoutMode";
import {
  canResumeHold,
  computeHoldStats,
  displayCashierName,
  displayCustomerName,
  filterHoldTable,
  HOLD_KPI_CARDS,
  HOLD_PAGE_SIZE,
  HOLD_TABLE_COLUMNS,
  HOLD_TABS,
  holdNumber,
  holdStatusLabel,
  holdStatusTone,
  lineAmount,
  matchesHoldSearch,
  paginateHoldRows,
  parseHeldSale,
  snapshotCartLines,
  snapshotCustomerName,
  snapshotTotals,
  uniqueHoldIds,
  viewHeldSale,
  type HoldTab,
  type PosHoldNavigationState,
} from "./held-sales";
import {
  POSActionBar,
  POSBadge,
  POSButton,
  POSCard,
  POSConfirmDialog,
  POSDrawer,
  POSEmptyState,
  POSErrorState,
  POSInput,
  POSLoadingState,
  POSModal,
  POSPageHeader,
  POSSearch,
  POSSelect,
  POSStatCard,
  POSTable,
  POSTableBody,
  POSTableHead,
  POSTabs,
  POSTd,
  POSTh,
} from "./design-system";
import { posCn } from "./design-system/posCn";

function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function formatHoldTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function kpiValue(id: (typeof HOLD_KPI_CARDS)[number]["id"], stats: ReturnType<typeof computeHoldStats>): string {
  if (id === "active") return String(stats.active);
  if (id === "expiring") return String(stats.expiring);
  if (id === "expired") return String(stats.expired);
  if (id === "today") return String(stats.today);
  return String(stats.mine);
}

function canMutateHold(
  hold: HeldSaleLifecycleView,
  userId: string | null,
  canHold: boolean,
  canResumeAny: boolean,
): boolean {
  if (!canHold) return false;
  return canActOnOwnedOrForeignHold({
    heldBy: hold.heldBy,
    actorUserId: userId,
    granted: canResumeAny ? ["pos.resume_any"] : [],
  });
}

function HoldDetail({
  selected,
  customerLabel,
  cashierLabel,
  detailLines,
  detailTotals,
  resumeOk,
  canMutate,
  busy,
  onViewDetails,
  onEdit,
  onTransfer,
  onDuplicate,
  onCancel,
  onResume,
  onResumeCheckout,
}: {
  selected: HeldSaleLifecycleView;
  customerLabel: string;
  cashierLabel: string;
  detailLines: ReturnType<typeof snapshotCartLines>;
  detailTotals: ReturnType<typeof snapshotTotals>;
  resumeOk: boolean;
  canMutate: boolean;
  busy: boolean;
  onViewDetails: () => void;
  onEdit: () => void;
  onTransfer: () => void;
  onDuplicate: () => void;
  onCancel: () => void;
  onResume: () => void;
  onResumeCheckout: () => void;
}) {
  const ownershipHint = canMutate ? undefined : "Requires your hold or pos.resume_any";
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-[var(--pos-ink)]">{holdNumber(selected)}</h2>
        <POSBadge tone={holdStatusTone(selected)}>{holdStatusLabel(selected)}</POSBadge>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-[var(--pos-muted)]">Customer</dt>
          <dd className="font-medium">{customerLabel}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-[var(--pos-muted)]">Cashier</dt>
          <dd className="font-medium">{cashierLabel}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[11px] uppercase tracking-wide text-[var(--pos-muted)]">Hold Reason</dt>
          <dd>{selected.holdReason?.trim() || "—"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[11px] uppercase tracking-wide text-[var(--pos-muted)]">Hold Notes</dt>
          <dd>{selected.notes?.trim() || "—"}</dd>
        </div>
      </dl>

      <div>
        <h3 className="mb-1 text-[13px] font-semibold">Items</h3>
        {detailLines.length === 0 ? (
          <p className="text-xs text-[var(--pos-muted)]">No catalog lines on this snapshot.</p>
        ) : (
          <POSTable>
            <POSTableHead>
              <tr>
                <POSTh>#</POSTh>
                <POSTh>Product</POSTh>
                <POSTh>SKU</POSTh>
                <POSTh>Qty</POSTh>
                <POSTh>Unit</POSTh>
                <POSTh>Rate</POSTh>
                <POSTh>Discount</POSTh>
                <POSTh>Tax</POSTh>
                <POSTh className="text-right">Total</POSTh>
              </tr>
            </POSTableHead>
            <POSTableBody>
              {detailLines.map((line, index) => (
                <tr key={line.key}>
                  <POSTd className="tabular-nums">{index + 1}</POSTd>
                  <POSTd>{line.name}</POSTd>
                  <POSTd>{line.sku || (line.isManual ? "Manual" : "—")}</POSTd>
                  <POSTd className="tabular-nums">{line.qty}</POSTd>
                  <POSTd>{line.unitName || "—"}</POSTd>
                  <POSTd className="tabular-nums">{formatMoney(line.unitPrice)}</POSTd>
                  <POSTd className="tabular-nums">{formatMoney(line.discount)}</POSTd>
                  <POSTd className="tabular-nums">{formatMoney(line.tax)}</POSTd>
                  <POSTd className="text-right tabular-nums">{formatMoney(lineAmount(line))}</POSTd>
                </tr>
              ))}
            </POSTableBody>
          </POSTable>
        )}
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatMoney(detailTotals?.subtotal)}</span>
        </div>
        <div className="flex justify-between text-[var(--pos-muted)]">
          <span>Discount</span>
          <span className="tabular-nums">−{formatMoney(detailTotals?.discount)}</span>
        </div>
        <div className="flex justify-between text-[var(--pos-muted)]">
          <span>Tax</span>
          <span className="tabular-nums">{formatMoney(detailTotals?.tax)}</span>
        </div>
        <div className="flex justify-between border-t border-[var(--pos-border)] pt-1 font-semibold">
          <span>Grand Total</span>
          <span className="tabular-nums">{formatMoney(detailTotals?.grand)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <POSButton size="sm" variant="ghost" onClick={onViewDetails}>
          View Details
        </POSButton>
        <POSButton
          size="sm"
          variant="secondary"
          onClick={onEdit}
          disabled={!resumeOk || !canMutate}
          title={ownershipHint ?? (resumeOk ? "Edit reason and notes" : "Expired holds cannot be edited")}
        >
          Edit Hold
        </POSButton>
        <POSButton size="sm" variant="ghost" onClick={onTransfer} disabled={!resumeOk || !canMutate} title={ownershipHint}>
          Transfer
        </POSButton>
        <POSButton size="sm" variant="ghost" onClick={onDuplicate} disabled={busy}>
          Duplicate
        </POSButton>
        <POSButton
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={selected.status !== "held" || busy || !canMutate}
          title={ownershipHint ?? "Cancel this hold"}
        >
          Cancel Hold
        </POSButton>
      </div>

      <POSActionBar
        sticky={false}
        className="mt-auto border-t-0 px-0"
        left={
          <POSButton
            variant="primary"
            onClick={onResume}
            disabled={!resumeOk || busy || !canMutate}
            title={
              ownershipHint ??
              (resumeOk ? "Restore this cart on New Sale" : "Expired or closed holds cannot be resumed")
            }
          >
            Resume Sale
          </POSButton>
        }
        right={
          <POSButton
            variant="secondary"
            onClick={onResumeCheckout}
            disabled={!resumeOk || busy || !canMutate}
            title={
              ownershipHint ??
              (resumeOk ? "Restore this cart and open payment" : "Expired or closed holds cannot be resumed")
            }
          >
            Resume & Checkout
          </POSButton>
        }
      />
    </div>
  );
}

export function HeldSalesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const layoutMode = usePosLayoutMode();
  const inlineDetail = layoutMode === "desktop";
  const { branchId, user, hasPermission } = useAuth();
  const userId = user?.id ?? null;
  const loadGen = useRef(0);

  const [records, setRecords] = useState<HeldSaleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<HoldTab>("all_pending");
  const [mineOnly, setMineOnly] = useState(false);
  const [cashierId, setCashierId] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [cashierNames, setCashierNames] = useState<Record<string, string>>({});
  const [cashiers, setCashiers] = useState<Array<{ id: string; name: string }>>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLabel, setEditLabel] = useState("");

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTo, setTransferTo] = useState("");

  const [confirm, setConfirm] = useState<{ kind: "resume"; checkout: boolean } | { kind: "cancel" } | null>(
    null,
  );

  const canHold = hasPermission("pos.hold");
  const canResumeAny = hasPermission("pos.resume_any");

  async function reload() {
    if (!branchId || !canHold) {
      setRecords([]);
      setLoadError(null);
      return;
    }
    const gen = ++loadGen.current;
    setLoading(true);
    setLoadError(null);
    try {
      // listHeldSales already applies expiry — do not call /holds/expire separately.
      const res = await posApi.listHolds(branchId, "all_pending");
      if (gen !== loadGen.current) return;
      setRecords(res.items.map((row) => parseHeldSale(row)));
    } catch (err) {
      if (gen !== loadGen.current) return;
      const message = err instanceof Error ? err.message : "Please try again";
      setLoadError(message);
      toast.push({ title: "Could not load held sales", description: message, tone: "danger" });
    } finally {
      if (gen === loadGen.current) setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    return () => {
      loadGen.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, canHold]);

  useEffect(() => {
    const missingCustomers = uniqueHoldIds(
      records
        .filter(
          (row) =>
            row.customerId &&
            !row.customerName &&
            !snapshotCustomerName(row.cartSnapshot) &&
            !customerNames[row.customerId],
        )
        .map((row) => row.customerId),
    );
    if (!missingCustomers.length) return;
    let cancelled = false;
    void Promise.all(
      missingCustomers.map((id) =>
        partiesApi.getCustomer(id).then(
          (customer) => [id, customer.name] as const,
          () => null,
        ),
      ),
    ).then((rows) => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const row of rows) {
        if (row) map[row[0]] = row[1];
      }
      if (Object.keys(map).length) setCustomerNames((prev) => ({ ...prev, ...map }));
    });
    return () => {
      cancelled = true;
    };
  }, [records, customerNames]);

  useEffect(() => {
    const ids = uniqueHoldIds(records.map((row) => row.heldBy));
    if (!ids.length || usersLoaded) return;
    let cancelled = false;
    void adminApi
      .listUsers()
      .then((res) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        const list: Array<{ id: string; name: string }> = [];
        for (const u of res.items) {
          const id = String(u.id ?? "");
          if (!id) continue;
          const name = String(u.full_name ?? u.fullName ?? u.email ?? "Cashier");
          map[id] = name;
          list.push({ id, name });
        }
        setCashierNames(map);
        setCashiers(list);
        setUsersLoaded(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [records, usersLoaded]);

  useEffect(() => {
    setPage(1);
  }, [tab, query, mineOnly, cashierId]);

  const stats = useMemo(() => computeHoldStats(records, userId), [records, userId]);
  const views = useMemo(() => records.map((row) => viewHeldSale(row)), [records]);

  const rows = useMemo(() => {
    return filterHoldTable(records, tab, { mineOnly, userId, cashierId: cashierId || null }).filter((hold) =>
      matchesHoldSearch(hold, query, {
        customerName: displayCustomerName(hold, customerNames),
        cashierName: displayCashierName(hold, cashierNames),
      }),
    );
  }, [records, tab, mineOnly, userId, cashierId, query, customerNames, cashierNames]);

  const paged = useMemo(() => paginateHoldRows(rows, page), [rows, page]);

  const selected: HeldSaleLifecycleView | null =
    views.find((hold) => hold.id === selectedId) ?? rows.find((hold) => hold.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && !views.some((hold) => hold.id === selectedId)) {
      setSelectedId(null);
      setDetailsOpen(false);
    }
  }, [views, selectedId]);

  function customerLabel(hold: HeldSaleLifecycleView): string {
    return displayCustomerName(hold, customerNames);
  }

  function cashierLabel(hold: HeldSaleLifecycleView): string {
    return displayCashierName(hold, cashierNames);
  }

  function selectHold(id: string, openDetails = true) {
    setSelectedId(id);
    if (openDetails) setDetailsOpen(true);
  }

  function goHoldCurrentSale() {
    const state: PosHoldNavigationState = { openHolds: true };
    navigate("/pos", { state });
  }

  async function afterAction(message: string) {
    toast.push({ title: message, tone: "success" });
    await reload();
  }

  async function resumeSelected(checkout: boolean) {
    if (!selected) return;
    setBusy(true);
    try {
      const held = (await posApi.resumeHold(selected.id, checkout)) as Record<string, unknown>;
      const snapshot =
        (held.cartSnapshot as Record<string, unknown> | undefined) ??
        (held.cart_snapshot as Record<string, unknown> | undefined) ??
        selected.cartSnapshot;
      const state: PosHoldNavigationState = { resumeSnapshot: snapshot, checkout };
      navigate("/pos", { state });
      toast.push({
        title: checkout ? "Bill resumed — complete payment" : "Bill resumed",
        tone: "success",
      });
    } catch (err) {
      toast.push({
        title: checkout ? "Resume & checkout failed" : "Resume failed",
        description: err instanceof Error ? err.message : "Please try again",
        tone: "danger",
      });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  function openEdit() {
    if (!selected) return;
    setEditLabel(selected.holdLabel ?? "");
    setEditReason(selected.holdReason ?? "");
    setEditNotes(selected.notes ?? "");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!selected) return;
    setBusy(true);
    try {
      await posApi.editHold(selected.id, {
        holdLabel: editLabel.trim() || undefined,
        holdReason: editReason.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });
      setEditOpen(false);
      await afterAction("Hold updated");
    } catch (err) {
      toast.push({
        title: "Edit failed",
        description: err instanceof Error ? err.message : "Please try again",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  async function ensureWarehouse(): Promise<string | null> {
    if (warehouseId) return warehouseId;
    const res = await inventoryApi.listWarehouses();
    const first = res.items[0];
    if (!first) return null;
    const id = String(first.id);
    setWarehouseId(id);
    return id;
  }

  async function duplicateSelected() {
    if (!selected) return;
    setBusy(true);
    try {
      const warehouse = await ensureWarehouse();
      if (!warehouse) {
        toast.push({
          title: "Warehouse required",
          description: "Open New Sale once so a warehouse is available, then duplicate.",
          tone: "danger",
        });
        return;
      }
      await posApi.duplicateHold(selected.id, { warehouseId: warehouse });
      await afterAction("Hold duplicated");
    } catch (err) {
      toast.push({
        title: "Duplicate failed",
        description: err instanceof Error ? err.message : "Please try again",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  async function ensureCashiers() {
    if (usersLoaded) return;
    const res = await adminApi.listUsers();
    const map: Record<string, string> = {};
    const list: Array<{ id: string; name: string }> = [];
    for (const u of res.items) {
      const id = String(u.id ?? "");
      if (!id) continue;
      const name = String(u.full_name ?? u.fullName ?? u.email ?? "Cashier");
      map[id] = name;
      list.push({ id, name });
    }
    setCashierNames(map);
    setCashiers(list);
    setUsersLoaded(true);
  }

  async function openTransfer() {
    setTransferTo("");
    setTransferOpen(true);
    try {
      await ensureCashiers();
    } catch {
      /* transfer modal shows empty cashier list */
    }
  }

  async function transferSelected() {
    if (!selected || !transferTo) return;
    setBusy(true);
    try {
      await posApi.transferHold(selected.id, { toUserId: transferTo });
      setTransferOpen(false);
      setTransferTo("");
      await afterAction("Hold transferred");
    } catch (err) {
      toast.push({
        title: "Transfer failed",
        description: err instanceof Error ? err.message : "Please try again",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  async function cancelSelected() {
    if (!selected) return;
    setBusy(true);
    try {
      await posApi.cancelHold(selected.id, "Cancelled from Hold / Resume");
      setSelectedId(null);
      setDetailsOpen(false);
      await afterAction("Hold cancelled");
    } catch (err) {
      toast.push({
        title: "Cancel failed",
        description: err instanceof Error ? err.message : "Please try again",
        tone: "danger",
      });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const detailLines = selected ? snapshotCartLines(selected.cartSnapshot) : [];
  const detailTotals = selected ? snapshotTotals(selected.cartSnapshot) : null;
  const resumeOk = selected ? canResumeHold(selected) : false;
  const canMutateSelected = selected ? canMutateHold(selected, userId, canHold, canResumeAny) : false;

  const cashierFilterOptions = uniqueHoldIds(records.map((row) => row.heldBy)).map((id) => ({
    value: id,
    label: cashierNames[id] ?? "Cashier",
  }));

  const detail = selected ? (
    <HoldDetail
      selected={selected}
      customerLabel={customerLabel(selected)}
      cashierLabel={cashierLabel(selected)}
      detailLines={detailLines}
      detailTotals={detailTotals}
      resumeOk={resumeOk}
      canMutate={canMutateSelected}
      busy={busy}
      onViewDetails={() => setDetailsOpen(true)}
      onEdit={openEdit}
      onTransfer={() => void openTransfer()}
      onDuplicate={() => void duplicateSelected()}
      onCancel={() => setConfirm({ kind: "cancel" })}
      onResume={() => setConfirm({ kind: "resume", checkout: false })}
      onResumeCheckout={() => setConfirm({ kind: "resume", checkout: true })}
    />
  ) : null;

  function onTableKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter") return;
    if (!paged.items.length) return;
    const index = paged.items.findIndex((hold) => hold.id === selectedId);
    if (event.key === "Enter" && selected && canResumeHold(selected) && canMutateSelected) {
      event.preventDefault();
      setConfirm({ kind: "resume", checkout: false });
      return;
    }
    event.preventDefault();
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = index < 0 ? 0 : Math.min(paged.items.length - 1, Math.max(0, index + delta));
    const next = paged.items[nextIndex];
    if (next) selectHold(next.id, inlineDetail);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-3">
      <div className="shrink-0 space-y-3">
        <POSPageHeader
          title="Hold / Resume Sale"
          subtitle="Manage your held sales, resume or delete holds."
          actions={
            <>
              <POSButton size="sm" variant="ghost" onClick={() => void reload()} disabled={loading}>
                Refresh
              </POSButton>
              <POSButton onClick={goHoldCurrentSale} disabled={!canHold}>
                + Hold Current Sale
              </POSButton>
            </>
          }
        />

        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {HOLD_KPI_CARDS.map((card) => {
            const active = mineOnly === card.mineOnly && tab === card.tab;
            return (
              <button
                key={card.id}
                type="button"
                className="text-left"
                onClick={() => {
                  setTab(card.tab);
                  setMineOnly(card.mineOnly);
                }}
              >
                <POSStatCard
                  label={card.label}
                  value={kpiValue(card.id, stats)}
                  tone={card.tone}
                  className={active ? "ring-1 ring-[var(--pos-primary)]" : undefined}
                />
              </button>
            );
          })}
        </div>

        <POSCard padding="sm">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[16rem] flex-1">
              <POSSearch
                label="Search"
                placeholder="Search by hold #, customer, cashier..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="w-[12rem]">
              <POSSelect
                compact
                label="Filters"
                aria-label="Filters"
                value={cashierId}
                onChange={(e) => setCashierId(e.target.value)}
                options={[{ value: "", label: "All cashiers" }, ...cashierFilterOptions]}
              />
            </div>
            <POSButton size="sm" variant={mineOnly ? "primary" : "ghost"} onClick={() => setMineOnly((value) => !value)}>
              Your Holds
            </POSButton>
          </div>
          <div className="mt-2">
            <POSTabs items={HOLD_TABS} value={tab} onChange={setTab} />
          </div>
        </POSCard>
      </div>

      <div
        className={posCn(
          "mt-3 grid min-h-0 flex-1 gap-3 overflow-hidden",
          inlineDetail && "xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.9fr)]",
        )}
      >
        <POSCard padding="none" className="flex min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto" tabIndex={0} onKeyDown={onTableKeyDown}>
            <POSTable>
                <POSTableHead>
                  <tr>
                    {HOLD_TABLE_COLUMNS.map((col) => (
                      <POSTh key={col} className={col === "Total Amount" ? "text-right" : undefined}>
                        {col}
                      </POSTh>
                    ))}
                  </tr>
                </POSTableHead>
                <POSTableBody>
                  {paged.items.map((hold) => {
                    const totals = snapshotTotals(hold.cartSnapshot);
                    const active = hold.id === selectedId;
                    const resumeRow = canResumeHold(hold) && canMutateHold(hold, userId, canHold, canResumeAny);
                    return (
                      <tr
                        key={hold.id}
                        className={active ? "bg-[var(--pos-light)]" : undefined}
                        aria-selected={active}
                        onClick={() => selectHold(hold.id)}
                      >
                        <POSTd>
                          <span className="font-medium">{holdNumber(hold)}</span>
                        </POSTd>
                        <POSTd>{customerLabel(hold)}</POSTd>
                        <POSTd>{cashierLabel(hold)}</POSTd>
                        <POSTd className="tabular-nums">{hold.cartItemCount}</POSTd>
                        <POSTd className="text-right tabular-nums">
                          {totals ? formatMoney(totals.grand) : "—"}
                        </POSTd>
                        <POSTd>{formatHoldTime(hold.heldAt)}</POSTd>
                        <POSTd>
                          <span className="line-clamp-2">{hold.holdReason?.trim() || "—"}</span>
                        </POSTd>
                        <POSTd>
                          <POSBadge tone={holdStatusTone(hold)}>{holdStatusLabel(hold)}</POSBadge>
                        </POSTd>
                        <POSTd>
                          {resumeRow ? (
                            <POSButton
                              size="sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                selectHold(hold.id);
                                setConfirm({ kind: "resume", checkout: false });
                              }}
                            >
                              Resume
                            </POSButton>
                          ) : (
                            <POSButton
                              size="sm"
                              variant="ghost"
                              onClick={(event) => {
                                event.stopPropagation();
                                selectHold(hold.id);
                              }}
                            >
                              View
                            </POSButton>
                          )}
                        </POSTd>
                      </tr>
                    );
                  })}
                </POSTableBody>
              </POSTable>
            {loading && records.length === 0 ? (
              <POSLoadingState label="Loading held sales…" rows={6} className="p-3" />
            ) : null}
            {loadError && records.length === 0 ? (
              <POSErrorState
                title="Could not load held sales"
                description={loadError}
                onAction={() => void reload()}
              />
            ) : null}
            {!canHold ? (
              <POSEmptyState
                title="Holds are not available"
                description="This cashier needs pos.hold permission to manage held sales."
              />
            ) : !loading && !loadError && rows.length === 0 ? (
              <POSEmptyState
                title="No held sales"
                description="Hold a cart from New Sale. Stats and this list use live hold records only."
                actionLabel="Go to New Sale"
                onAction={() => navigate("/pos")}
              />
            ) : null}
          </div>
          {paged.total > HOLD_PAGE_SIZE ? (
            <div className="flex items-center justify-between border-t border-[var(--pos-border)] px-3 py-2 text-xs text-[var(--pos-muted)]">
              <span>
                {paged.total} holds · page {paged.page} of {paged.pageCount}
              </span>
              <div className="flex gap-1">
                <POSButton size="sm" variant="ghost" disabled={paged.page <= 1} onClick={() => setPage((value) => value - 1)}>
                  Previous
                </POSButton>
                <POSButton
                  size="sm"
                  variant="ghost"
                  disabled={paged.page >= paged.pageCount}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </POSButton>
              </div>
            </div>
          ) : null}
        </POSCard>

        {inlineDetail ? (
          <POSCard padding="sm" className="flex min-h-0 flex-col overflow-hidden">
            {!selected ? (
              <POSEmptyState
                title="Select a hold"
                description="Choose a row to see customer, items, totals, and resume actions."
              />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-auto">{detail}</div>
            )}
          </POSCard>
        ) : (
          <POSDrawer
            open={Boolean(selected) && detailsOpen}
            title={selected ? holdNumber(selected) : "Hold"}
            onClose={() => setDetailsOpen(false)}
            side="bottom"
            size="lg"
          >
            {detail}
          </POSDrawer>
        )}
      </div>

      <POSModal
        open={editOpen}
        title="Edit Hold"
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <POSButton variant="ghost" onClick={() => setEditOpen(false)} disabled={busy}>
              Close
            </POSButton>
            <POSButton onClick={() => void saveEdit()} loading={busy}>
              Save
            </POSButton>
          </>
        }
      >
        <div className="space-y-3">
          <POSInput label="Hold #" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
          <POSInput label="Hold reason" value={editReason} onChange={(e) => setEditReason(e.target.value)} />
          <POSInput label="Hold notes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
        </div>
      </POSModal>

      <POSModal
        open={transferOpen}
        title="Transfer hold"
        onClose={() => setTransferOpen(false)}
        footer={
          <>
            <POSButton variant="ghost" onClick={() => setTransferOpen(false)} disabled={busy}>
              Close
            </POSButton>
            <POSButton onClick={() => void transferSelected()} disabled={!transferTo} loading={busy}>
              Transfer
            </POSButton>
          </>
        }
      >
        {cashiers.length === 0 ? (
          <p className="text-sm text-[var(--pos-muted)]">
            Cashier list is unavailable. Transfer needs a named cashier — IDs are not typed in by hand.
          </p>
        ) : (
          <POSSelect
            label="Transfer to cashier"
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            options={[
              { value: "", label: "Select cashier" },
              ...cashiers
                .filter((cashier) => cashier.id !== selected?.heldBy)
                .map((cashier) => ({ value: cashier.id, label: cashier.name })),
            ]}
          />
        )}
      </POSModal>

      <POSConfirmDialog
        open={confirm?.kind === "resume"}
        title={confirm && "checkout" in confirm && confirm.checkout ? "Resume and checkout?" : "Resume this sale?"}
        description="The parked cart will replace the New Sale cart. Stock is not posted until you complete payment."
        confirmLabel={confirm && "checkout" in confirm && confirm.checkout ? "Resume & Checkout" : "Resume Sale"}
        loading={busy}
        onConfirm={() => void resumeSelected(Boolean(confirm && "checkout" in confirm && confirm.checkout))}
        onCancel={() => setConfirm(null)}
      />
      <POSConfirmDialog
        open={confirm?.kind === "cancel"}
        title="Cancel this hold?"
        description="The parked sale will be cancelled. This does not post stock."
        confirmLabel="Cancel Hold"
        danger
        loading={busy}
        onConfirm={() => void cancelSelected()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
