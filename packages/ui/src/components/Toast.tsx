import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cn } from "../lib/cn.js";

export type ToastTone = "info" | "success" | "warning" | "danger";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

export interface ToastContextValue {
  push: (toast: Omit<ToastItem, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClass: Record<ToastTone, string> = {
  info: "erp-toast-info border-l-4 border-blue-500",
  success: "erp-toast-success border-l-4 border-emerald-500",
  warning: "border-l-4 border-amber-500",
  danger: "erp-toast-danger border-l-4 border-rose-500",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = crypto.randomUUID();
    setItems((prev) => [...prev, { ...toast, id }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto rounded-[var(--erp-radius)] border border-[var(--erp-border)] bg-[var(--erp-surface)] px-3 py-2.5 shadow-[var(--erp-shadow-md)]",
              toneClass[item.tone],
            )}
          >
            <p className="text-sm font-semibold text-[var(--erp-ink)]">{item.title}</p>
            {item.description ? (
              <p className="text-xs text-[var(--erp-muted)]">{item.description}</p>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
