import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAddEvent, useAddTask } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { BirthdayList, useBirthdays } from "@/components/BirthdayList";

export const Route = createFileRoute("/event/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    type: (search["type"] as string) ?? "event",
    day: search["day"] ? Number(search["day"]) : undefined,
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

const HE_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

const QUICK_NAMES = [
  { label: "אמא", emoji: "👩" },
  { label: "אבא", emoji: "👨" },
  { label: "בת/בן זוג", emoji: "💑" },
  { label: "אח", emoji: "👦" },
  { label: "אחות", emoji: "👧" },
  { label: "חבר טוב", emoji: "🧑" },
  { label: "סבתא", emoji: "👵" },
  { label: "סבא", emoji: "👴" },
];

const ease = "cubic-bezier(0.23, 1, 0.32, 1)";

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

// ── Birthday Form ─────────────────────────────────────────────────────────────

function BirthdayForm() {
  const addEvent = useAddEvent();
  const [name, setName] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth()); // 0-based
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [savedName, setSavedName] = useState<string | null>(null);
  const { birthdays } = useBirthdays();

  // Leap-year reference (2024) on purpose: a 29 Feb birthday must stay
  // selectable in every year, not just leap years.
  const daysInMonth = new Date(2024, selectedMonth + 1, 0).getDate();

  // Preview label
  const preview = name.trim()
    ? `🎂 יום הולדת ל${name.trim()}`
    : "🎂 יום הולדת ל...";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("נא להזין שם"); return; }
    if (!selectedDay) { setError("נא לבחור יום"); return; }
    setError("");

    try {
      await addEvent.mutateAsync({
        title: `יום הולדת ל${name.trim()}`,
        day: selectedDay,
        month: selectedMonth + 1,
        time: "כל היום",
        end_time: null,
        location: null,
        category: "family",
        is_birthday: true,
      });
      // Stay here: the list below updates with the new entry, and the form is
      // ready for the next one — adding several birthdays in a row is common.
      setSavedName(name.trim());
      setName("");
      setSelectedDay(null);
    } catch (err) {
      // Previously unhandled: a failed insert did nothing and the birthday was lost
      setError(`השמירה נכשלה: ${(err as Error).message ?? "נסה שוב"}`);
    }
  }

  return (
    <div className="pb-28 space-y-8">
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Preview banner */}
      <div
        className="rounded-3xl bg-primary/8 border border-primary/20 px-5 py-4 text-center"
        style={{ animation: `fade-up 280ms ${ease} both` }}
      >
        <p className="text-xl font-bold text-primary">{preview}</p>
      </div>

      {/* Quick-add chips */}
      <div style={{ animation: `fade-up 280ms ${ease} 40ms both` }}>
        <p className="text-sm font-semibold mb-2.5">בחר מהרשימה</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_NAMES.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => { setName(q.label); setSavedName(null); }}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-[transform,background-color] active:scale-[0.93]",
                name === q.label
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
              style={{ transitionTimingFunction: ease, transitionDuration: "160ms" }}
            >
              <span>{q.emoji}</span>
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Name input */}
      <div style={{ animation: `fade-up 280ms ${ease} 80ms both` }}>
        <p className="text-sm font-semibold mb-1.5">או הקלד שם</p>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setSavedName(null); }}
          placeholder="שם המאורגן..."
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {/* Month grid — 4×3, all months visible */}
      <div style={{ animation: `fade-up 280ms ${ease} 120ms both` }}>
        <p className="text-sm font-semibold mb-2.5">חודש</p>
        <div className="grid grid-cols-4 gap-1.5">
          {HE_MONTHS.map((m, i) => (
            <button
              key={m}
              type="button"
              data-active={selectedMonth === i ? "true" : "false"}
              onClick={() => {
                setSelectedMonth(i);
                // Keep the chosen day. Clearing it unconditionally meant that
                // picking the day first and the month second — the natural
                // order, since the day grid is already showing — silently wiped
                // the day. Only drop it when it can't exist in the new month
                // (e.g. 31 -> February).
                const daysInNewMonth = new Date(2024, i + 1, 0).getDate();
                setSelectedDay((d) => (d !== null && d > daysInNewMonth ? null : d));
              }}
              className={cn(
                "rounded-xl py-2.5 text-xs font-bold transition-[transform,background-color,color] active:scale-[0.90]",
                selectedMonth === i
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-foreground hover:bg-primary/12 hover:text-primary"
              )}
              style={{ transitionTimingFunction: ease, transitionDuration: "140ms" }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Day grid */}
      <div style={{ animation: `fade-up 280ms ${ease} 160ms both` }}>
        <p className="text-sm font-semibold mb-2.5">יום</p>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDay(d === selectedDay ? null : d)}
              className={cn(
                "aspect-square rounded-xl text-sm font-bold transition-[transform,background-color,color] active:scale-[0.85]",
                selectedDay === d
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground hover:bg-primary/12 hover:text-primary"
              )}
              style={{ transitionTimingFunction: ease, transitionDuration: "140ms" }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      {selectedDay && name.trim() && (
        <div
          className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success/8 px-4 py-3"
          style={{ animation: `fade-up 220ms ${ease} both` }}
        >
          <span className="text-2xl">🎂</span>
          <div>
            <p className="text-sm font-bold">יום הולדת ל{name.trim()}</p>
            <p className="text-xs text-muted-foreground">{selectedDay} ב{HE_MONTHS[selectedMonth]}</p>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={addEvent.isPending || !name.trim() || !selectedDay}
        className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition-[transform,opacity] active:scale-[0.97] disabled:opacity-40"
        style={{ transitionTimingFunction: ease, transitionDuration: "160ms" }}
      >
        {addEvent.isPending ? "שומר..." : "הוסף יום הולדת 🎂"}
      </button>

      {savedName && (
        <p className="text-center text-sm font-semibold text-success" aria-live="polite">
          יום ההולדת של {savedName} נשמר ✓
        </p>
      )}
    </form>

    {/* Saved birthdays — outside the <form> so its delete buttons can't submit it */}
    {birthdays.length > 0 && (
      <div className="border-t border-border/60 pt-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-bold">ימי ההולדת שלך</h2>
          <span className="text-xs text-muted-foreground">{birthdays.length} אנשים</span>
        </div>
        <BirthdayList birthdays={birthdays} />
      </div>
    )}
    </div>
  );
}

// ── Event Form ────────────────────────────────────────────────────────────────

function EventForm({ initialDay }: { initialDay?: number | undefined }) {
  const navigate = useNavigate();
  const addEvent = useAddEvent();

  const defaultDate = initialDay
    ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(initialDay).padStart(2, "0")}`
    : todayStr;

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [allDay, setAllDay] = useState(false);
  const [time, setTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState<string>("work");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("נא להזין כותרת"); return; }
    if (!date) { setError("נא לבחור תאריך"); return; }
    setError("");

    const d = new Date(date + "T00:00:00");
    try {
      await addEvent.mutateAsync({
        title: title.trim(),
        day: d.getDate(),
        // Without month the event matched the same day in every month
        month: d.getMonth() + 1,
        time: allDay ? "כל היום" : time,
        end_time: (!allDay && endTime) ? endTime : null,
        location: location.trim() || null,
        category,
        is_birthday: false,
      });
      navigate({ to: "/calendar" });
    } catch (err) {
      // Previously unhandled: a failed insert did nothing and the entry was lost
      setError(`השמירה נכשלה: ${(err as Error).message ?? "נסה שוב"}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-24">
      <div>
        <label className="block text-sm font-semibold mb-1.5">כותרת</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="שם האירוע"
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1.5">תאריך</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

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

      {!allDay && (
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

      <div>
        <label className="block text-sm font-semibold mb-1.5">תאריך יעד</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

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
    type === "birthday" ? "הוסף יום הולדת" :
    type === "task" ? "משימה חדשה" :
    "אירוע חדש";

  return (
    <AppShell title={title}>
      {type === "task" ? (
        <TaskForm />
      ) : type === "birthday" ? (
        <BirthdayForm />
      ) : (
        <EventForm initialDay={day} />
      )}
    </AppShell>
  );
}
