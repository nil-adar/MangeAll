import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAddExpense } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/expense/new")({
  validateSearch: (search: Record<string, unknown>): { mode: string } => ({
    mode: (search["mode"] as string) ?? "once",
  }),
  component: NewExpensePage,
});

const CATEGORIES = [
  { key: "family", label: "משפחה" },
  { key: "work", label: "עבודה" },
  { key: "health", label: "בריאות" },
  { key: "money", label: "כספים" },
  { key: "shopping", label: "קניות" },
] as const;

const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

function ExpenseForm({ fixed }: { fixed: boolean }) {
  const navigate = useNavigate();
  const addExpense = useAddExpense();

  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr);
  const [category, setCategory] = useState<string>("money");
  const [repeat, setRepeat] = useState<"monthly" | "yearly">("monthly");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendor.trim()) { setError("נא להזין שם ספק"); return; }
    const parsedAmount = Number(amount);
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("נא להזין סכום תקין");
      return;
    }
    if (!date) { setError("נא לבחור תאריך"); return; }
    setError("");

    await addExpense.mutateAsync({
      vendor: vendor.trim(),
      amount: parsedAmount,
      category,
      date,
      repeat: fixed ? repeat : "once",
    });
    navigate({ to: "/finance" });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-24">
      {/* Vendor */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">ספק / חנות</label>
        <input
          type="text"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="שם הספק"
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          autoFocus
        />
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">סכום</label>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">{fixed ? "תאריך התחלה" : "תאריך"}</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Repeat (fixed expenses only) */}
      {fixed && (
        <div>
          <label className="block text-sm font-semibold mb-2">תדירות</label>
          <div className="flex gap-2">
            {(["monthly", "yearly"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRepeat(r)}
                className={cn(
                  "flex-1 rounded-2xl py-2.5 text-xs font-semibold transition-colors",
                  repeat === r
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {r === "monthly" ? "חודשי" : "שנתי"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category */}
      <div>
        <label className="block text-sm font-semibold mb-2">קטגוריה</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                category === c.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={addExpense.isPending}
        className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground active:scale-95 transition disabled:opacity-60"
      >
        {addExpense.isPending ? "שומר..." : "שמור הוצאה"}
      </button>
    </form>
  );
}

function NewExpensePage() {
  const { mode } = Route.useSearch();

  const title =
    mode === "fixed" ? "הוצאה קבועה" : mode === "scan" ? "סריקת קבלה" : "הוצאה מזדמנת";

  return (
    <AppShell title={title}>
      {mode === "scan" ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <Camera className="size-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">סריקת קבלה – בקרוב</p>
        </div>
      ) : (
        <ExpenseForm fixed={mode === "fixed"} />
      )}
    </AppShell>
  );
}
