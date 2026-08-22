import { useEffect, useState } from "react";
import { posApi } from "../api";
import { money } from "../format";
import type { PosDrawerSummary } from "../types";

const FALLBACK_DRAWER: PosDrawerSummary = {
  opening: "25,000.00",
  inHand: "32,450.00",
  sales: "78,320.00",
  expenses: "-2,000.00",
  expected: "101,320.00",
};

export function usePosShell(branchId: string | null) {
  const [holdCount, setHoldCount] = useState(0);
  const [shiftOpen, setShiftOpen] = useState(true);
  const [drawer, setDrawer] = useState<PosDrawerSummary>(FALLBACK_DRAWER);
  const [terminalId] = useState("POS-01");

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;

    async function load() {
      try {
        const shiftRes = await posApi.currentShift(branchId!);
        const shift = shiftRes.item;
        if (cancelled) return;
        setShiftOpen(Boolean(shift));
        if (shift) {
          setDrawer({
            opening: money(Number(shift.openingFloat ?? 0)),
            inHand: money(Number(shift.expectedCash ?? shift.cashInHand ?? 0)),
            sales: money(Number(shift.totalSales ?? 0)),
            expenses: money(Number(shift.totalExpenses ?? 0)),
            expected: money(Number(shift.expectedCash ?? 0)),
          });
        }
      } catch {
        if (!cancelled) setDrawer(FALLBACK_DRAWER);
      }

      try {
        const holds = await posApi.listHolds(branchId!);
        if (!cancelled) setHoldCount(holds.items.length);
      } catch {
        if (!cancelled) setHoldCount(0);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  return { holdCount, shiftOpen, drawer, terminalId };
}
