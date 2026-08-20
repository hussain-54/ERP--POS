import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/features/users/admin-api";
import { infrastructureApi } from "@/features/system/infrastructure-api";
import { posApi } from "../pos-api";
import { cachedPosFetch } from "../pos-bootstrap-cache";
import { POS_TERMINAL_STORAGE_KEY } from "../pos-layout";
import { formatRegisterMoney, parseCashShift } from "../register-shift";

export type PosNamedOption = { value: string; label: string };

export type PosDrawerSummary = {
  opening: string;
  inHand: string;
  sales: string;
  expenses: string;
  expected: string;
};

const EMPTY_DRAWER: PosDrawerSummary = {
  opening: "—",
  inHand: "—",
  sales: "—",
  expenses: "—",
  expected: "—",
};

function readStoredTerminal(): string {
  try {
    return window.localStorage.getItem(POS_TERMINAL_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Live shift / hold / terminal chrome for the POS shell.
 * Uses existing POS and admin APIs only. Failures stay honest (no shift, zero holds).
 */
export function usePosShellStatus(
  branchId: string | null,
  branchIds: string[],
): {
  holdCount: number;
  shiftOpen: boolean;
  drawer: PosDrawerSummary;
  branchOptions: PosNamedOption[];
  terminalOptions: PosNamedOption[];
  terminalId: string;
  setTerminalId: (id: string) => void;
} {
  const [holdCount, setHoldCount] = useState(0);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [drawer, setDrawer] = useState<PosDrawerSummary>(EMPTY_DRAWER);
  const [branchOptions, setBranchOptions] = useState<PosNamedOption[]>([]);
  const [terminalOptions, setTerminalOptions] = useState<PosNamedOption[]>([]);
  const [terminalId, setTerminalIdState] = useState(readStoredTerminal);

  const setTerminalId = useCallback((id: string) => {
    setTerminalIdState(id);
    try {
      if (id) window.localStorage.setItem(POS_TERMINAL_STORAGE_KEY, id);
      else window.localStorage.removeItem(POS_TERMINAL_STORAGE_KEY);
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  useEffect(() => {
    if (!branchId) {
      setHoldCount(0);
      setShiftOpen(false);
      setDrawer(EMPTY_DRAWER);
      return;
    }
    let cancelled = false;
    void posApi
      .listHolds(branchId, undefined, { applyExpiry: false })
      .then((res) => {
        if (!cancelled) setHoldCount(res.items.length);
      })
      .catch(() => {
        if (!cancelled) setHoldCount(0);
      });
    void posApi
      .currentShift(branchId)
      .then((res) => {
        if (cancelled) return;
        const shift = parseCashShift(res.item);
        setShiftOpen(Boolean(shift && shift.status === "open"));
        if (!shift) {
          setDrawer(EMPTY_DRAWER);
          return;
        }
        const expected =
          shift.expectedCash ?? shift.openingFloat + shift.cashSalesTotal - shift.expenseTotal;
        setDrawer({
          opening: formatRegisterMoney(shift.openingFloat),
          inHand: formatRegisterMoney(expected),
          sales: formatRegisterMoney(shift.salesTotal),
          expenses: formatRegisterMoney(shift.expenseTotal),
          expected: formatRegisterMoney(expected),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setShiftOpen(false);
          setDrawer(EMPTY_DRAWER);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  const branchIdsKey = branchIds.join("\0");

  useEffect(() => {
    const scopedIds = branchIdsKey ? branchIdsKey.split("\0") : [];
    let cancelled = false;
    try {
      void cachedPosFetch("pos:branches", () => adminApi.listBranches())
        .then((res) => {
          if (cancelled) return;
          const byId = new Map(
            res.items.map((row) => [String(row.id ?? ""), String(row.name ?? "Branch")]),
          );
          const options = (scopedIds.length ? scopedIds : [...byId.keys()]).map((id) => ({
            value: id,
            label: byId.get(id) || `Branch ${id.slice(0, 8)}`,
          }));
          setBranchOptions(options.filter((row) => row.value));
        })
        .catch(() => {
          if (!cancelled) {
            setBranchOptions(scopedIds.map((id) => ({ value: id, label: `Branch ${id.slice(0, 8)}` })));
          }
        });
    } catch {
      setBranchOptions(scopedIds.map((id) => ({ value: id, label: `Branch ${id.slice(0, 8)}` })));
    }
    try {
      void cachedPosFetch("pos:devices", () => infrastructureApi.devices())
        .then((res) => {
          if (cancelled) return;
          const options = res.items
            .map((row) => {
              const value = String(row.id ?? row.device_id ?? "");
              const label = String(row.name ?? row.label ?? row.code ?? "Terminal");
              return { value, label };
            })
            .filter((row) => row.value);
          setTerminalOptions(options.length ? options : [{ value: "", label: "This terminal" }]);
          if (!readStoredTerminal() && options[0]?.value) setTerminalId(options[0].value);
        })
        .catch(() => {
          if (!cancelled) setTerminalOptions([{ value: "", label: "This terminal" }]);
        });
    } catch {
      setTerminalOptions([{ value: "", label: "This terminal" }]);
    }
    return () => {
      cancelled = true;
    };
  }, [branchIdsKey, setTerminalId]);

  return {
    holdCount,
    shiftOpen,
    drawer,
    branchOptions,
    terminalOptions,
    terminalId,
    setTerminalId,
  };
}
