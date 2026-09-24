import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAddEvent, useAddTask } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/event/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    type: (search.type as string) ?? "event",
    day: search.day ? Number(search.day) : undefined,
  }),
  component: NewEventPage,
});

const CATEGORIES = [
  { key: "family", label: "משפחה" },
  { key: "work", label: "עבודה" },
  { key: "health", label: "בריאות" },
  { key: "money", label: "כספים" },
  { key: "shopping", label: "קניות" },
] as const;

const PRIORITIES = ["גבוהה", "רגילה", "נמוכה"] as const;

const today = new Date();
const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

function hebrewDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  const diff = Math.round((d.getTime() - new Date(todayStr + "T00:00:00").getTime()) / 86400000);
  if (diff === 0) return "היום";
  if (diff === 1) return "מחר";
  if (diff === -1) return "אתמול";
  if (diff > 0 && diff <= 6) return `בעוד ${diff} ימים`;
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "long" });
}

// ── Event Form ────────────────────────────────────────────────────────────────

function EventForm({ isBirthday, initialDay }: { isBirthday: boolean; initialDay?: number }) {
  const navigate = useNavigate();
  const addEvent = useAddEvent();

  const defaultDate = initialDay
    ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(initialDay).padStart(2, "0")}`
    : todayStr;

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [allDay, setAllDay] = useState(isBirthday);
  const [time, setTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState<string>(isBirthday ? "family" : "work");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("נא להזין כותרת"); return; }
    if (!date) { setError("נא לבחור תאריך"); return; }
    setError("");

    const day = new Date(date + "T00:00:00").getDate();
    await addEvent.mutateAsync({
      title: title.trim(),
      day,
      time: allDay ? "כל היום" : time,
      end_time: (!allDay && endTime) ? endTime : null,
      location: location.trim() || null,
      category,
      is_birthday: isBirthday,
    });
    navigate({ to: "/calendar" });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-24">
      {/* Title */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">כותרת</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isBirthday ? "יום הולדת ל..." : "שם האירוע"}
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          autoFocus
        />
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">תאריך</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* All day toggle */}
      {!isBirthday && (
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
          <span className="text-sm font-semibold">כל היום</span>
          <button
            type="button"
            onClick={() => setAllDay((v) => !v)}
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors",
              allDay ? "bg-primary" : "bg-muted"
            )}
          >
            <span className={cn(
              "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
              allDay ? "translate-x-5" : "translate-x-0.5"
            )} />
          </button>
        </div>
      )}

      {/* Time */}
      {!allDay && !isBirthday && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold mb-1.5">שעת התחלה</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">שעת סיום</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      )}

      {/* Location */}
      {!isBirthday && (
        <div>
          <label className="block text-sm font-semibold mb-1.5">מיקום (אופציונלי)</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="כתובת או שם מקום"
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
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
        disabled={addEvent.isPending}
        className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground active:scale-95 transition disabled:opacity-60"
      >
        {addEvent.isPending ? "שומר..." : "שמור אירוע"}
      </button>
    </form>
  );
}

// ── Task Form ─────────────────────────────────────────────────────────────────

function TaskForm() {
  const navigate = useNavigate();
  const addTask = useAddTask();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayStr);
  const [priority, setPriority] = useState<"גבוהה" | "רגילה" | "נמוכה">("רגילה");
  const [category, setCategory] = useState("work");
  const [isToday, setIsToday] = useState(true);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("נא להזין כותרת"); return; }
    setError("");

    await addTask.mutateAsync({
      title: title.trim(),
      due: hebrewDate(date),
      priority,
      category,
      done: false,
      today: isToday,
    });
    navigate({ to: "/tasks" });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-24">
      {/* Title */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">כותרת המשימה</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="מה צריך לעשות?"
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          autoFocus
        />
      </div>

      {/* Due date */}
      <div>
        <label className="block text-sm font-semibold mb-1.5">תאריך יעד</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Today toggle */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
        <span className="text-sm font-semibold">משימה להיום</span>
        <button
          type="button"
          onClick={() => setIsToday((v) => !v)}
          className={cn(
            "relative h-6 w-11 rounded-full transition-colors",
            isToday ? "bg-primary" : "bg-muted"
          )}
        >
          <span className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
            isToday ? "translate-x-5" : "translate-x-0.5"
          )} />
        </button>
      </div>

      {/* Priority */}
      <div>
        <label className="block text-sm font-semibold mb-2">עדיפות</label>
        <div className="flex gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={cn(
                "flex-1 rounded-2xl py-2 text-xs font-semibold transition-colors",
                priority === p
                  ? p === "גבוהה" ? "bg-red-500 text-white"
                    : p === "רגילה" ? "bg-amber-500 text-white"
                    : "bg-muted text-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

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
        disabled={addTask.isPending}
        className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground active:scale-95 transition disabled:opacity-60"
      >
        {addTask.isPending ? "שומר..." : "שמור משימה"}
      </button>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function NewEventPage() {
  const { type, day } = Route.useSearch();

  const title =
    type === "birthday" ? "יום הולדת" :
    type === "task" ? "משימה חדשה" :
    "אירוע חדש";

  return (
    <AppShell title={title}>
      {type === "task" ? (
        <TaskForm />
      ) : (
        <EventForm isBirthday={type === "birthday"} initialDay={day} />
      )}
    </AppShell>
  );
}
