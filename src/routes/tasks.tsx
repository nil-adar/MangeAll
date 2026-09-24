import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Circle,
  ClipboardList,
  Plus,
  Sparkles,
  Target,
  Flame,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { taskBucket, daysLate, lateLabel, BUCKET_LABEL, BUCKET_ORDER } from "@/lib/task-status";
import { useTasks, useToggleTask, useAddTask, useDeleteTask, getCat } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/queries";

const ease = "cubic-bezier(0.23, 1, 0.32, 1)";

export const Route = createFileRoute("/tasks")({
  component: TasksPage,
});

type FilterKey = "all" | "today" | "late" | "high";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",   label: "הכל" },
  { key: "today", label: "היום" },
  { key: "late",  label: "באיחור" },
  { key: "high",  label: "דחופות" },
];

const priorityBorder: Record<Task["priority"], string> = {
  גבוהה: "border-r-[3px] border-r-red-400",
  רגילה: "border-r-[3px] border-r-amber-400",
  נמוכה: "border-r-[3px] border-r-transparent",
};

const priorityDot: Record<Task["priority"], string> = {
  גבוהה: "bg-red-400",
  רגילה: "bg-amber-400",
  נמוכה: "bg-transparent",
};

// Grouping lives in lib/task-status: `due` is a label frozen at creation, so
// it needs created_at to tell a task that is still for today from one that is
// simply late.

// ── Add Task Modal ────────────────────────────────────────────────────────────

function AddTaskModal({ onClose }: { onClose: () => void }) {
  const addTask = useAddTask();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("היום");
  const [priority, setPriority] = useState<Task["priority"]>("רגילה");
  const [category, setCategory] = useState("כללי");
  const [today, setToday] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await addTask.mutateAsync({
      title: title.trim(),
      due,
      priority,
      category,
      done: false,
      today,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ animation: `fade-up 200ms ${ease} both` }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="relative z-10 w-full rounded-t-3xl bg-background px-5 pt-5 pb-8 shadow-2xl"
        style={{ animation: `fade-up 220ms ${ease} both` }}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">משימה חדשה</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <input
            autoFocus
            type="text"
            placeholder="שם המשימה..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm font-semibold placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          {/* Row: due + priority */}
          <div className="flex gap-3">
            <select
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="flex-1 rounded-xl border border-border bg-muted px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
            >
              <option value="היום">היום</option>
              <option value="מחר">מחר</option>
              <option value="השבוע">השבוע</option>
              <option value="בהמשך">בהמשך</option>
            </select>

            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task["priority"])}
              className="flex-1 rounded-xl border border-border bg-muted px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
            >
              <option value="גבוהה">🔴 גבוהה</option>
              <option value="רגילה">🟡 רגילה</option>
              <option value="נמוכה">⚪ נמוכה</option>
            </select>
          </div>

          {/* Category */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
          >
            <option value="כללי">כללי</option>
            <option value="עבודה">עבודה</option>
            <option value="קניות">קניות</option>
            <option value="בריאות">בריאות</option>
            <option value="ילדים">ילדים</option>
            <option value="בית">בית</option>
          </select>

          {/* Today toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setToday(!today)}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors duration-200",
                today ? "bg-primary" : "bg-border"
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
                  today ? "translate-x-0.5" : "translate-x-[21px]"
                )}
              />
            </div>
            <span className="text-sm font-semibold">משימה להיום</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={!title.trim() || addTask.isPending}
            className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition-[opacity,transform] duration-[160ms] active:scale-[0.97] disabled:opacity-50"
            style={{ transitionTimingFunction: ease }}
          >
            {addTask.isPending ? "שומר..." : "+ הוסף משימה"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function TasksPage() {
  const { data: tasks = [], isLoading } = useTasks();
  const toggle = useToggleTask();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const isEmpty = !isLoading && tasks.length === 0;

  const todayOpen      = open.filter((t) => taskBucket(t) === "today");
  const lateOpen       = open.filter((t) => taskBucket(t) === "overdue");
  const todayDone      = done.filter((t) => t.today);
  const totalToday     = todayOpen.length + todayDone.length;
  const todayPercent   = totalToday > 0 ? Math.round((todayDone.length / totalToday) * 100) : 0;
  const highCount      = open.filter((t) => t.priority === "גבוהה").length;

  let filtered = open;
  if (filter === "today") filtered = open.filter((t) => taskBucket(t) === "today");
  if (filter === "late")  filtered = lateOpen;
  if (filter === "high")  filtered = open.filter((t) => t.priority === "גבוהה");

  const groups = BUCKET_ORDER
    .map((bucket) => ({
      bucket,
      label: BUCKET_LABEL[bucket],
      items: filtered.filter((t) => taskBucket(t) === bucket),
    }))
    .filter((g) => g.items.length > 0);

  function handleToggle(task: Task) {
    if (task.done) {
      toggle.mutate({ id: task.id, done: false });
      return;
    }
    setLeaving((prev) => new Set(prev).add(task.id));
    setTimeout(() => {
      toggle.mutate({ id: task.id, done: true });
      setLeaving((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }, 320);
  }

  return (
    <>
      <AppShell
        title="משימות"
        subtitle={!isLoading ? `${open.length} פתוחות` : undefined}
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition-transform duration-[160ms] active:scale-[0.93]"
            style={{ transitionTimingFunction: ease }}
          >
            <Plus className="size-3.5" />
            הוסף משימה
          </button>
        }
      >
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="size-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : isEmpty ? (
          <EmptyState onAdd={() => setShowAdd(true)} />
        ) : (
          <div className="space-y-5 pb-24">

            {/* Today progress card */}
            {totalToday > 0 && (
              <section
                className="surface-card rounded-2xl p-4"
                style={{ animation: `fade-up 280ms ${ease} both` }}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <Target className="size-4 text-primary" />
                    <span className="text-sm font-bold">משימות היום</span>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                    {todayDone.length}/{totalToday}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${todayPercent}%`,
                      transformOrigin: "left center",
                      animation: `grow-bar 700ms ${ease} both`,
                    }}
                  />
                </div>
                {todayPercent === 100 && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="size-3" />
                    כל משימות היום הושלמו!
                  </p>
                )}
              </section>
            )}

            {/* Quick info chips */}
            <div
              className="flex flex-wrap gap-2"
              style={{ animation: `fade-up 280ms ${ease} 50ms both` }}
            >
              {highCount > 0 && (
                <div className="flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 py-1.5">
                  <Flame className="size-3.5 text-red-500" />
                  <span className="text-xs font-semibold text-red-600">{highCount} דחופות</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
                <span className="text-xs font-semibold text-muted-foreground">
                  {open.length} פתוחות · {done.length} הושלמו
                </span>
              </div>
            </div>

            {/* Filter chips */}
            <div
              className="flex gap-2"
              style={{ animation: `fade-up 280ms ${ease} 80ms both` }}
            >
              {FILTERS.filter((f) => f.key !== "late" || lateOpen.length > 0).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-[background-color,color,transform] duration-[160ms] active:scale-[0.93]",
                    filter === f.key
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                  style={{ transitionTimingFunction: ease }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Open task groups */}
            {groups.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {filter === "today"
                  ? "אין משימות להיום 🎉"
                  : filter === "late"
                    ? "אין משימות באיחור 🎉"
                    : "אין משימות דחופות"}
              </p>
            ) : (
              <div
                className="space-y-5"
                style={{ animation: `fade-up 280ms ${ease} 120ms both` }}
              >
                {groups.map((g) => (
                  <section key={g.label}>
                    <p className={cn("eyebrow mb-2", g.bucket === "overdue" && "font-bold text-destructive")}>
                      {g.label}
                      {g.bucket === "overdue" && ` · ${g.items.length}`}
                    </p>
                    <ul className="space-y-2 stagger-list">
                      {g.items.map((t) => (
                        <TaskCard
                          key={t.id}
                          task={t}
                          isLeaving={leaving.has(t.id)}
                          onToggle={() => handleToggle(t)}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            {/* Completed section */}
            {done.length > 0 && (
              <section
                className="opacity-60"
                style={{ animation: `fade-up 280ms ${ease} 180ms both` }}
              >
                <p className="eyebrow mb-2">הושלמו ({done.length})</p>
                <ul className="space-y-2">
                  {done.slice(0, 5).map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      isLeaving={false}
                      onToggle={() => handleToggle(t)}
                      faded
                    />
                  ))}
                  {done.length > 5 && (
                    <p className="py-2 text-center text-xs text-muted-foreground">
                      +{done.length - 5} נוספות הושלמו
                    </p>
                  )}
                </ul>
              </section>
            )}
          </div>
        )}

        {/* FAB */}
        <button
          onClick={() => setShowAdd(true)}
          className="fixed bottom-24 left-5 z-20 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_-10px_oklch(0_0_0/30%)] transition-[transform,box-shadow] duration-[160ms] active:scale-[0.92]"
          style={{ transitionTimingFunction: ease }}
          aria-label="משימה חדשה"
        >
          <Plus className="size-5" />
        </button>
      </AppShell>

      {showAdd && <AddTaskModal onClose={() => setShowAdd(false)} />}
    </>
  );
}

// ── Task Card ──────────────────────────────────────────────────────────────────

function TaskCard({
  task: t,
  isLeaving,
  onToggle,
  faded = false,
}: {
  task: Task;
  isLeaving: boolean;
  onToggle: () => void;
  faded?: boolean;
}) {
  const cat = getCat(t.category);
  const deleteTask = useDeleteTask();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    deleteTask.mutate(t.id);
  }

  return (
    <li
      className={cn(
        "surface-card flex items-center gap-3 rounded-2xl p-3.5 overflow-hidden transition-[opacity,transform]",
        priorityBorder[t.priority],
        isLeaving && "opacity-0 scale-[0.96] pointer-events-none"
      )}
      style={{
        transitionDuration: isLeaving ? "300ms" : "200ms",
        transitionTimingFunction: ease,
      }}
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        disabled={isLeaving}
        className="shrink-0 text-primary transition-transform duration-[160ms] active:scale-[0.75]"
        style={{ transitionTimingFunction: ease }}
        aria-label={t.done ? "בטל סימון" : "סמן כהושלם"}
      >
        {t.done ? (
          <CheckCircle2 className="size-5 fill-primary text-primary-foreground" />
        ) : (
          <Circle className="size-5 text-border" />
        )}
      </button>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-bold truncate transition-[color,text-decoration] duration-300",
            faded && "line-through text-muted-foreground"
          )}
        >
          {t.title}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          {daysLate(t) > 0 && !faded ? (
            <span className="text-xs font-bold text-destructive">{lateLabel(daysLate(t))}</span>
          ) : (
            <span className="text-xs text-muted-foreground">{t.due}</span>
          )}
          {!faded && t.priority !== "נמוכה" && (
            <span className={cn("size-1.5 rounded-full", priorityDot[t.priority])} />
          )}
        </div>
      </div>

      {/* Category badge */}
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cat.soft}`}>
        {cat.label}
      </span>

      {/* Delete button */}
      <button
        onClick={handleDelete}
        disabled={deleteTask.isPending}
        className={cn(
          "shrink-0 rounded-full p-1.5 transition-[background-color,color,transform] duration-[160ms] active:scale-[0.85]",
          confirmDelete
            ? "bg-red-100 text-red-500"
            : "text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground"
        )}
        style={{ transitionTimingFunction: ease }}
        aria-label="מחק משימה"
        title={confirmDelete ? "לחץ שוב למחיקה" : "מחק"}
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-24 text-center"
      style={{ animation: `fade-up 400ms ${ease} both` }}
    >
      <div className="mb-5 flex size-16 items-center justify-center rounded-2xl border border-primary/15 bg-primary/8">
        <ClipboardList className="size-7 text-primary opacity-60" />
      </div>
      <p className="mb-1.5 text-base font-bold text-foreground">אין עדיין משימות</p>
      <p className="mb-7 max-w-[200px] text-sm leading-relaxed text-muted-foreground">
        הוסף משימה ראשונה ותתחיל לנהל את היום שלך
      </p>
      <button
        onClick={onAdd}
        className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-transform duration-[160ms] active:scale-[0.97]"
        style={{ transitionTimingFunction: ease }}
      >
        + משימה חדשה
      </button>
    </div>
  );
}
