import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { restoreHoldTransaction } from "@electronic-erp/domain";
import { useToast } from "@electronic-erp/ui";
import { money } from "../format";
import { SalesPageShell } from "./SalesPageShell";
import { SalesRegister } from "./SalesRegister";

const LOCAL_DRAFT_KEY = "erp-pos-drafts";

type LocalDraft = {
  id: string;
  savedAt: string;
  label?: string;
  snapshot: Record<string, unknown>;
};

function loadLocalDrafts(): LocalDraft[] {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as LocalDraft[]) : [];
  } catch {
    return [];
  }
}

function saveLocalDrafts(drafts: LocalDraft[]) {
  localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(drafts.slice(0, 40)));
}

/** Local device drafts + server draft rows in one sales screen. */
export function DraftSalesRegister() {
  const { push } = useToast();
  const navigate = useNavigate();
  const [localDrafts, setLocalDrafts] = useState<LocalDraft[]>([]);

  const refreshLocal = useCallback(() => {
    setLocalDrafts(loadLocalDrafts());
  }, []);

  useEffect(() => {
    refreshLocal();
  }, [refreshLocal]);

  function resumeLocal(draft: LocalDraft) {
    try {
      restoreHoldTransaction(draft.snapshot);
      navigate("/pos/sales/new", { state: { resumeSnapshot: draft.snapshot } });
    } catch (err) {
      push({
        title: "Invalid draft",
        description: err instanceof Error ? err.message : "Could not restore",
        tone: "danger",
      });
    }
  }

  function removeLocal(id: string) {
    const next = loadLocalDrafts().filter((d) => d.id !== id);
    saveLocalDrafts(next);
    setLocalDrafts(next);
  }

  return (
    <SalesPageShell
      title="Draft sales"
      description="Local drafts on this device, plus unfinished server drafts."
      actions={
        <>
          <button
            type="button"
            onClick={refreshLocal}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Refresh local
          </button>
          <Link to="/pos/sales/new" className="rounded-xl bg-[var(--pos-primary)] px-3 py-2 text-xs font-bold text-white">
            New Sale
          </Link>
        </>
      }
    >
      <div className="mb-3 shrink-0">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Device drafts</h2>
        {localDrafts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-xs text-slate-400">
            No local drafts. Use Save Draft on the terminal.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {localDrafts.map((d) => {
              let items = 0;
              let grand = 0;
              try {
                const restored = restoreHoldTransaction(d.snapshot);
                items = restored.cart.length;
                grand = restored.totals?.grand ?? 0;
              } catch {
                /* ignore */
              }
              return (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{d.label || "Draft"}</p>
                    <p className="text-[11px] text-slate-400">
                      {items} items · {money(grand)} · {new Date(d.savedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => resumeLocal(d)}
                      className="rounded-lg bg-[var(--pos-primary)] px-2.5 py-1.5 text-[11px] font-bold text-white"
                    >
                      Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLocal(d.id)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <h2 className="mb-2 shrink-0 text-xs font-bold uppercase tracking-wide text-slate-500">Server drafts</h2>
      <SalesRegister variant="draft" embedded />
    </SalesPageShell>
  );
}
