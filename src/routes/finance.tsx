import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Receipt, RefreshCw, Sparkles, Pencil, Trash2, Check, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  useExpenses,
  useDeleteExpense,
  useMonthlyBudget,
  useSetMonthlyBudget,
  getCat,
  isThisMonth,
  type Expense,
} from "@/lib/queries";
import {
  expenses as demoExpenses,
  recurringExpenses as demoRecurring,
} from "@/lib/demo-data";
import { shekel, DEFAULT_MONTHLY_BUDGET } from "@/lib/config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/finance")({
  component: FinancePage,
});

function FinancePage() {
  const { data: expenses = [], isLoading } = useExpenses();
  const { data: monthlyBudget = DEFAULT_MONTHLY_BUDGET } = useMonthlyBudget();
  const setBudget = useSetMonthlyBudget();
  const deleteExpense = useDeleteExpense();

  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const isEmpty = !isLoading && expenses.length === 0;

  // Real data split
  // One-time expenses belong to the month they were spent in: the total and
  // the "recorded this month" list both reset on the 1st. Older rows are kept
  // in the database, just not counted. Recurring ones apply every month.
  const oneTime = expenses.filter(
    (e) => (!e.repeat || e.repeat === "once") && isThisMonth(e.date)
  );
  const recurring = expenses.filter((e) => e.repeat === "monthly" || e.repeat === "yearly");

  // Demo data (shown faded for new users)
  const demoOneTime: Expense[] = demoExpenses.map((e) => ({
    id: e.id, vendor: e.vendor, amount: e.amount, category: e.category,
    date: e.date, repeat: "once" as const, created_at: "",
  }));
  const demoRecurringExpenses: Expense[] = demoRecurring.map((r) => ({
    id: r.id, vendor: r.vendor, amount: r.amount, category: r.category,
    date: "", repeat: (r.repeat === "monthly" ? "monthly" : "yearly") as "monthly" | "yearly",
    created_at: "",
  }));

  const displayOneTime = isEmpty ? demoOneTime : oneTime;
  const displayRecurring = isEmpty ? demoRecurringExpenses : recurring;

  // Monthly spend = one-off spend + monthly subscriptions + yearly amortised
  // over 12. This must stay identical to the calculation on the home page
  // (routes/index.tsx) or the two screens report different totals.
  const sum = (items: Expense[]) => items.reduce((s, e) => s + e.amount, 0);

  const sourceOneTime = isEmpty ? demoOneTime : oneTime;
  const sourceRecurring = isEmpty ? demoRecurringExpenses : recurring;

  const monthlyRecurringTotal = sum(
    sourceRecurring.filter((e) => e.repeat === "monthly")
  );
  const yearlyAsMonthly = sourceRecurring
    .filter((e) => e.repeat === "yearly")
    .reduce((s, e) => s + Math.round(e.amount / 12), 0);

  const monthlySpent =
    sum(sourceOneTime) + monthlyRecurringTotal + yearlyAsMonthly;
  const percent = Math.min(100, Math.round((monthlySpent / monthlyBudget) * 100));
  const remaining = monthlyBudget - monthlySpent;
  const isOver = remaining < 0;

  function startEditBudget() {
    setBudgetDraft(String(monthlyBudget));
    setEditingBudget(true);
  }

  function saveBudget() {
    const val = parseInt(budgetDraft.replace(/\D/g, ""), 10);
    if (val > 0) setBudget.mutate(val);
    setEditingBudget(false);
  }

  function handleDelete(id: string) {
    if (confirmDeleteId === id) {
      deleteExpense.mutate(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  }

  return (
    <AppShell title="כספים">
      {/* Budget card */}
      <section className="surface-card rounded-3xl p-5 mb-5">
        <div className="flex items-center justify-between mb-1">
          <p className="eyebrow">הוצאות החודש</p>
          {!editingBudget && (
            <button
              onClick={startEditBudget}
              className="flex items-center gap-1 text-xs text-muted-foreground active:scale-95 transition"
            >
              <Pencil className="size-3" />
              ערוך תקציב
            </button>
          )}
        </div>

        {editingBudget ? (
          <div className="flex items-center gap-2 mt-1 mb-2">
            <span className="text-2xl font-bold text-muted-foreground">₪</span>
            <input
              type="number"
              value={budgetDraft}
              onChange={(e) => setBudgetDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveBudget(); if (e.key === "Escape") setEditingBudget(false); }}
              className="flex-1 text-3xl font-bold tabular-nums bg-transparent border-b-2 border-primary outline-none"
              autoFocus
              dir="ltr"
            />
            <button onClick={saveBudget} className="rounded-xl bg-primary p-2 text-primary-foreground active:scale-95">
              <Check className="size-4" />
            </button>
            <button onClick={() => setEditingBudget(false)} className="rounded-xl bg-muted p-2 active:scale-95">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <p className="text-4xl font-bold tabular-nums mt-1">
            {shekel(monthlySpent)}
            <span className="text-base font-medium text-muted-foreground"> / {shekel(monthlyBudget)}</span>
          </p>
        )}

        <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isEmpty && "opacity-40",
              isOver ? "bg-destructive" : percent > 80 ? "bg-amber-500" : "bg-primary"
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className={`mt-2 text-sm font-semibold ${isOver ? "text-destructive" : "text-muted-foreground"}`}>
          {isOver ? `חרגת ב-${shekel(Math.abs(remaining))}` : `נותרו ${shekel(remaining)} לחודש`}
        </p>

        {/* Breakdown — makes it obvious that recurring expenses are counted */}
        {monthlyRecurringTotal + yearlyAsMonthly > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {shekel(sum(sourceOneTime))} מזדמנות
            {" · "}
            {shekel(monthlyRecurringTotal + yearlyAsMonthly)} קבועות
          </p>
        )}
      </section>

      {/* Quick add buttons */}
      <div className="flex gap-3 mb-5">
        <Link
          to="/expense/new"
          search={{ mode: "once" }}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground active:scale-95 transition"
        >
          <Receipt className="size-4" />
          הוצאה מזדמנת
        </Link>
        <Link
          to="/expense/new"
          search={{ mode: "fixed" }}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-muted py-3 text-sm font-semibold text-foreground active:scale-95 transition"
        >
          <RefreshCw className="size-4" />
          הוצאה קבועה
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="size-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {isEmpty && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/8 p-3.5">
              <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-primary">תוכן לדוגמה</p>
                <p className="text-xs text-muted-foreground mt-0.5">הוסף הוצאה ראשונה ודוגמאות אלו יעלמו</p>
              </div>
            </div>
          )}

          <div className="space-y-6 pb-24">
            {/* One-time expenses */}
            <section>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold">הוצאות אחרונות</h2>
                <Link to="/expense/new" search={{ mode: "once" } as never} className="text-xs font-bold text-primary">
                  + הוסף
                </Link>
              </div>
              <p className="text-xs text-muted-foreground mb-3">הוצאות חד-פעמיות שנרשמו החודש</p>
              <ExpenseList
                items={displayOneTime}
                isDemo={isEmpty}
                icon="receipt"
                confirmDeleteId={confirmDeleteId}
                onDelete={handleDelete}
              />
            </section>

            {/* Recurring expenses */}
            <section>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold">הוצאות קבועות</h2>
                <Link to="/expense/new" search={{ mode: "fixed" } as never} className="text-xs font-bold text-primary">
                  + הוסף
                </Link>
              </div>
              <p className="text-xs text-muted-foreground mb-3">מנויים ותשלומים חוזרים (חודשי / שנתי)</p>
              <ExpenseList
                items={displayRecurring}
                isDemo={isEmpty}
                icon="repeat"
                confirmDeleteId={confirmDeleteId}
                onDelete={handleDelete}
                labelFn={(e) => e.repeat === "monthly" ? "חודשי" : "שנתי"}
              />
            </section>
          </div>
        </>
      )}

      <Link
        to="/expense/new"
        search={{ mode: "once" } as never}
        className="fixed bottom-24 left-5 z-20 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-95"
      >
        <Plus className="size-5" />
      </Link>
    </AppShell>
  );
}

function ExpenseList({
  items,
  isDemo,
  icon,
  confirmDeleteId,
  onDelete,
  labelFn,
}: {
  items: Expense[];
  isDemo: boolean;
  icon: "receipt" | "repeat";
  confirmDeleteId: string | null;
  onDelete: (id: string) => void;
  labelFn?: (e: Expense) => string;
}) {
  const Icon = icon === "receipt" ? Receipt : RefreshCw;
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">אין עדיין</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((e) => {
        const cat = getCat(e.category);
        const isConfirming = confirmDeleteId === e.id;
        return (
          <li
            key={e.id}
            className={cn("surface-card flex items-center gap-3 rounded-2xl p-3.5", isDemo && "opacity-50")}
          >
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${cat.soft}`}>
              <Icon className="size-4" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{e.vendor}</p>
              <p className="text-xs text-muted-foreground">{labelFn ? labelFn(e) : e.date}</p>
            </div>
            <p className="text-sm font-bold tabular-nums shrink-0">{shekel(e.amount)}</p>
            {!isDemo && (
              <button
                onClick={() => onDelete(e.id)}
                className={cn(
                  "shrink-0 rounded-xl p-2 transition active:scale-95",
                  isConfirming
                    ? "bg-destructive text-destructive-foreground"
                    : "text-muted-foreground hover:text-destructive"
                )}
                title={isConfirming ? "לחץ שוב למחיקה" : "מחק"}
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
