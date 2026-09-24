import { createContext, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

export type Scope = "all" | "family" | "work";

interface ScopeCtx {
  scope: Scope;
  setScope: (s: Scope) => void;
}

// ── Context ──────────────────────────────────────────────────────────────────

const ScopeContext = createContext<ScopeCtx>({
  scope: "all",
  setScope: () => undefined,
});

export function ScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<Scope>("all");
  return (
    <ScopeContext.Provider value={{ scope, setScope }}>
      {children}
    </ScopeContext.Provider>
  );
}

export function useScope() {
  return useContext(ScopeContext);
}

// ── Category → scope mapping ─────────────────────────────────────────────────

const FAMILY_CATS = new Set(["family", "health", "shopping"]);
const WORK_CATS = new Set(["work", "money"]);

export function inScope(category: string, scope: Scope): boolean {
  if (scope === "all") return true;
  if (scope === "family") return FAMILY_CATS.has(category);
  if (scope === "work") return WORK_CATS.has(category);
  return true;
}

// ── UI Component ─────────────────────────────────────────────────────────────

const BUTTONS: { key: Scope; label: string }[] = [
  { key: "all", label: "הכול" },
  { key: "family", label: "משפחה" },
  { key: "work", label: "עבודה" },
];

export function ScopeSwitch() {
  const { scope, setScope } = useScope();
  return (
    <div className="flex gap-2 overflow-x-auto" role="group" aria-label="סנן לפי תחום">
      {BUTTONS.map((b) => (
        <button
          key={b.key}
          onClick={() => setScope(b.key)}
          className={cn(
            "rounded-full px-3.5 py-1 text-xs font-semibold shrink-0 transition-colors",
            scope === b.key
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
