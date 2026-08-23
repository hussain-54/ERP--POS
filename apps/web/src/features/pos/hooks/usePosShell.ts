import { useEffect, useState } from "react";
import { posApi } from "../api";
import { money } from "../format";
import { mapShiftRow } from "../shift/shift-utils";
import type { PosDrawerSummary } from "../types";

const EMPTY_DRAWER: PosDrawerSummary = {
  opening: "0.00",
  inHand: "0.00",
  sales: "0.00",
  expenses: "0.00",
  expected: "0.00",
};

export function usePosShell(branchId: string | null) {
  const [holdCount, setHoldCount] = useState(0);
  const [shiftOpen, setShiftOpen] = useState(true);
  const [drawer, setDrawer] = useState<PosDrawerSummary>(EMPTY_DRAWER);
  const [terminalId] = useState("POS-01");

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;

    async function load() {
      try {
        const shiftRes = await posApi.currentShift(branchId!);
        const mapped = mapShiftRow(shiftRes.item);
        if (cancelled) return;
        setShiftOpen(Boolean(mapped && mapped.status === "open"));
        if (mapped) {
          setDrawer({
            opening: money(mapped.openingFloat),
            inHand: money(mapped.expectedCash),
            sales: money(mapped.salesTotal),
            expenses: money(mapped.expenseTotal),
            expected: money(mapped.expectedCash),
          });
        } else {
          setDrawer(EMPTY_DRAWER);
        }
      } catch {
        if (!cancelled) {
          setShiftOpen(false);
          setDrawer(EMPTY_DRAWER);
        }
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
