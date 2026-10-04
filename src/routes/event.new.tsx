import { useState } from "react";
import { createFileRoute, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import {
  useAddEvent,
  useAddExpense,
  useAddTask,
  useEvents,
  useUpdateEvent,
  type CalEvent,
} from "@/lib/queries";
import { cn } from "@/lib/utils";
import { BirthdayList, extractName, useBirthdays } from "@/components/BirthdayList";
import {
  OCCASIONS,
  OCCASION_ORDER,
  detectOccasion,
  isOccasionType,
  joinNames,
  occasionTitle,
  splitOccasionTitle,
  type OccasionType,
} from "@/lib/occasions";
import {
  HEBREW_MONTH_CHOICES,
  currentMonthChoice,
  daysInChoice,
  hasHebrewDate,
  hebrewDateLabel,
  hebrewFieldsLabel,
  hebrewFieldsOf,
  hebrewNumeral,
  monthChoiceOf,
  nextHebrewOccurrence,
  type HebrewMonthChoice,
} from "@/lib/hebrew-date";

export const Route = createFileRoute("/event/new")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { type: string; day?: number | undefined; edit?: string } => ({
    type: (search["type"] as string) ?? "event",
    day: search["day"] ? Number(search["day"]) : undefined,
    // The id of an existing event: the same forms open filled in, and saving
    // updates it instead of adding a new one.
    ...(typeof search["edit"] === "string" ? { edit: search["edit"] } : {}),
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

/**
 * A saved event's date as "YYYY-MM-DD", for a date input. Most events have no
 * year (they repeat yearly), so those show in the current year; rows from
 * before the month column show in the current month.
 */
function eventDateISO(e: CalEvent): string {
  // Its stored day/month is one past occurrence; the date input wants the next
  const next = hasHebrewDate(e) ? nextHebrewOccurrence(e) : null;
  if (next) return toISO(next);
  const y = e.year ?? today.getFullYear();
  const m = e.month ?? today.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}-${String(e.day).padStart(2, "0")}`;
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Fields that switch a saved event off the Hebrew date. */
const NO_HEBREW_DATE = { hebrew_day: null, hebrew_month: null, hebrew_year: null };

/** The "לפי התאריך העברי" switch, shared by the birthday and event forms. */
function HebrewDateToggle({ on, onChange, hint }: { on: boolean; onChange: (v: boolean) => void; hint: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-semibold">לפי התאריך העברי</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="לפי התאריך העברי"
        onClick={() => onChange(!on)}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-muted")}
      >
        <span className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
          on ? "translate-x-5" : "translate-x-0.5"
        )} />
      </button>
    </div>
  );
}

/** After saving an edit: back to the screen it was opened from. */
function useLeaveEdit(fallback: "/calendar" | "/birthdays" | "/occasions") {
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  return () => (canGoBack ? router.history.back() : navigate({ to: fallback }));
}

// ── Birthday Form ─────────────────────────────────────────────────────────────

function BirthdayForm({ editing }: { editing?: CalEvent | undefined }) {
  const addEvent = useAddEvent();
  const updateEvent = useUpdateEvent();
  const leaveEdit = useLeaveEdit("/birthdays");
  const [name, setName] = useState(editing ? extractName(editing.title) : "");
  const [selectedMonth, setSelectedMonth] = useState(
    editing?.month ? editing.month - 1 : today.getMonth()
  ); // 0-based
  const [selectedDay, setSelectedDay] = useState<number | null>(editing?.day ?? null);
  // A Hebrew birthday is picked as a Hebrew month + day instead
  const wasHebrew = !!editing && hasHebrewDate(editing);
  const [hebrew, setHebrew] = useState(wasHebrew);
  const [hChoice, setHChoice] = useState<HebrewMonthChoice>(() =>
    editing && hasHebrewDate(editing) ? monthChoiceOf(editing.hebrew_month, editing.hebrew_year) : currentMonthChoice()
  );
  const [hDay, setHDay] = useState<number | null>(editing?.hebrew_day ?? null);
  const [error, setError] = useState("");
  const [savedName, setSavedName] = useState<string | null>(null);
  const { birthdays } = useBirthdays();
  const busy = addEvent.isPending || updateEvent.isPending;

  // The Hebrew date to save. An unchanged one keeps its stored year (a real
  // birth year, when it came from the event form) rather than the stand-in.
  const hebrewFields = hebrew && hDay
    ? {
        hebrew_day: hDay,
        hebrew_month: hChoice.month,
        hebrew_year:
          editing && hasHebrewDate(editing) && editing.hebrew_day === hDay &&
          monthChoiceOf(editing.hebrew_month, editing.hebrew_year).id === hChoice.id
            ? editing.hebrew_year
            : hChoice.year,
      }
    : null;
  const hebrewNext = hebrewFields ? nextHebrewOccurrence({ title: "", ...hebrewFields }) : null;
  const ready = hebrew ? !!hebrewNext : !!selectedDay;

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
    if (!ready) { setError("נא לבחור יום"); return; }
    setError("");

    // A Hebrew birthday keeps this year's Gregorian date in day/month too
    const date = hebrew && hebrewNext
      ? { day: hebrewNext.getDate(), month: hebrewNext.getMonth() + 1, ...hebrewFields }
      : { day: selectedDay!, month: selectedMonth + 1, ...(wasHebrew ? NO_HEBREW_DATE : {}) };

    if (editing) {
      try {
        await updateEvent.mutateAsync({
          id: editing.id,
          title: `יום הולדת ל${name.trim()}`,
          ...date,
          is_birthday: true,
        });
        leaveEdit();
      } catch (err) {
        setError(`השמירה נכשלה: ${(err as Error).message ?? "נסה שוב"}`);
      }
      return;
    }

    try {
      await addEvent.mutateAsync({
        title: `יום הולדת ל${name.trim()}`,
        ...date,
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
      setHDay(null);
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

      <div style={{ animation: `fade-up 280ms ${ease} 100ms both` }}>
        <HebrewDateToggle
          on={hebrew}
          onChange={setHebrew}
          hint="יום הולדת עברי, כמו ט״ו באב. זז כל שנה בלוח הלועזי"
        />
      </div>

      {hebrew ? (
        <>
          {/* Hebrew months — Adar I / II only matter for someone born in a leap year */}
          <div style={{ animation: `fade-up 220ms ${ease} both` }}>
            <p className="text-sm font-semibold mb-2.5">חודש עברי</p>
            <div className="grid grid-cols-4 gap-1.5">
              {HEBREW_MONTH_CHOICES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setHChoice(c);
                    setHDay((d) => (d !== null && d > daysInChoice(c) ? null : d));
                  }}
                  className={cn(
                    "rounded-xl py-2.5 text-xs font-bold transition-[transform,background-color,color] active:scale-[0.90]",
                    hChoice.id === c.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-foreground hover:bg-primary/12 hover:text-primary"
                  )}
                  style={{ transitionTimingFunction: ease, transitionDuration: "140ms" }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ animation: `fade-up 220ms ${ease} 40ms both` }}>
            <p className="text-sm font-semibold mb-2.5">יום</p>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: daysInChoice(hChoice) }, (_, i) => i + 1).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setHDay(d === hDay ? null : d)}
                  className={cn(
                    "aspect-square rounded-xl text-sm font-bold transition-[transform,background-color,color] active:scale-[0.85]",
                    hDay === d
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground hover:bg-primary/12 hover:text-primary"
                  )}
                  style={{ transitionTimingFunction: ease, transitionDuration: "140ms" }}
                  aria-label={`${d}`}
                >
                  {hebrewNumeral(d)}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
      <>
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
      </>
      )}

      {/* Summary */}
      {hebrew && hebrewFields && hebrewNext && name.trim() ? (
        <div
          className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success/8 px-4 py-3"
          style={{ animation: `fade-up 220ms ${ease} both` }}
        >
          <span className="text-2xl">🎂</span>
          <div>
            <p className="text-sm font-bold">יום הולדת ל{name.trim()}</p>
            <p className="text-xs text-muted-foreground">
              {hebrewFieldsLabel({ title: "", ...hebrewFields })} · הפעם ב-
              {hebrewNext.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
      ) : !hebrew && selectedDay && name.trim() && (
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
        disabled={busy || !name.trim() || !ready}
        className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition-[transform,opacity] active:scale-[0.97] disabled:opacity-40"
        style={{ transitionTimingFunction: ease, transitionDuration: "160ms" }}
      >
        {busy ? "שומר..." : editing ? "שמור שינויים" : "הוסף יום הולדת 🎂"}
      </button>

      {savedName && (
        <p className="text-center text-sm font-semibold text-success" aria-live="polite">
          יום ההולדת של {savedName} נשמר ✓
        </p>
      )}
    </form>

    {/* Saved birthdays — outside the <form> so its delete buttons can't submit it.
        Not while editing: the page is about the one being changed. */}
    {!editing && birthdays.length > 0 && (
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

// ── Occasion Form (שמחות) ──────────────────────────────────────────────────────

/** Next time a day/month comes round, as "YYYY-MM-DD" — today counts. */
function nextOccurrenceISO(month: number, day: number): string {
  const mmdd = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const y = today.getFullYear();
  return `${y}-${mmdd}` >= todayStr ? `${y}-${mmdd}` : `${y + 1}-${mmdd}`;
}

function OccasionForm({ editing }: { editing?: CalEvent | undefined }) {
  const navigate = useNavigate();
  const addEvent = useAddEvent();
  const updateEvent = useUpdateEvent();
  const addExpense = useAddExpense();
  const leaveEdit = useLeaveEdit("/occasions");

  const initialType: OccasionType = isOccasionType(editing?.occasion) ? editing.occasion : "wedding";
  const [initialName1, initialName2] = editing ? splitOccasionTitle(initialType, editing.title) : ["", ""];

  const [type, setType] = useState<OccasionType>(initialType);
  const [name1, setName1] = useState(initialName1);
  const [name2, setName2] = useState(initialName2);
  const [date, setDate] = useState(editing ? eventDateISO(editing) : "");
  const [time, setTime] = useState(editing && editing.time !== "כל היום" ? editing.time : "");
  const [location, setLocation] = useState(editing?.location ?? "");
  const [gift, setGift] = useState(editing?.gift != null ? String(editing.gift) : "");
  const [logExpense, setLogExpense] = useState(true);
  const [error, setError] = useState("");

  const meta = OCCASIONS[type];
  const isAnniversary = type === "anniversary";
  const names = meta.couple ? joinNames(name1, name2) : name1.trim();
  const title = occasionTitle(type, names);
  const giftAmount = Number(gift);
  const hasGift = gift.trim() !== "" && Number.isFinite(giftAmount) && giftAmount > 0;
  const busy = addEvent.isPending || updateEvent.isPending || addExpense.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!names) { setError("נא להזין שם"); return; }
    if (!date) { setError("נא לבחור תאריך"); return; }
    if (gift.trim() !== "" && !hasGift) { setError("סכום המתנה לא תקין"); return; }
    setError("");

    const [y, m, d] = date.split("-").map(Number) as [number, number, number];

    // Editing changes the occasion only. Any expense logged when it was added
    // stays as it is in Finance — logging again here would count the gift twice.
    if (editing) {
      try {
        await updateEvent.mutateAsync({
          id: editing.id,
          title,
          day: d,
          month: m,
          year: y,
          occasion: type,
          time: time || "כל היום",
          location: location.trim() || null,
          gift: hasGift ? giftAmount : null,
        });
        leaveEdit();
      } catch (err) {
        setError(`השמירה נכשלה: ${(err as Error).message ?? "נסה שוב"}`);
      }
      return;
    }

    try {
      await addEvent.mutateAsync({
        title,
        day: d,
        month: m,
        // One-time occasions only show in this year; for an anniversary it's
        // the wedding year, which is what "שנה X" counts from.
        year: y,
        occasion: type,
        time: time || "כל היום",
        end_time: null,
        location: location.trim() || null,
        category: "family",
        is_birthday: false,
        gift: hasGift ? giftAmount : null,
      });
    } catch (err) {
      setError(`השמירה נכשלה: ${(err as Error).message ?? "נסה שוב"}`);
      return;
    }

    if (hasGift && logExpense) {
      try {
        await addExpense.mutateAsync({
          vendor: `מתנה – ${title}`,
          amount: giftAmount,
          category: "family",
          // Spent on the day itself. An anniversary's stored date is the
          // wedding, years back, so use the coming one instead.
          date: isAnniversary ? nextOccurrenceISO(m, d) : date,
          repeat: "once",
        });
      } catch (err) {
        setError(`השמחה נשמרה, אבל רישום ההוצאה נכשל: ${(err as Error).message ?? "נסה שוב"}`);
        return;
      }
    }
    navigate({ to: "/occasions" });
  }

  const inputCls =
    "w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-28">
      {/* Preview banner — the title is generated, not typed */}
      <div
        className="rounded-3xl bg-primary/8 border border-primary/20 px-5 py-4 text-center"
        style={{ animation: `fade-up 280ms ${ease} both` }}
      >
        <p className="text-xl font-bold text-primary">
          {meta.emoji} {names ? title : `${meta.prefix}...`}
        </p>
      </div>

      {/* Type chips */}
      <div style={{ animation: `fade-up 280ms ${ease} 40ms both` }}>
        <p className="text-sm font-semibold mb-2.5">איזו שמחה?</p>
        <div className="flex flex-wrap gap-2">
          {OCCASION_ORDER.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-[transform,background-color] active:scale-[0.93]",
                type === t ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              )}
              style={{ transitionTimingFunction: ease, transitionDuration: "160ms" }}
            >
              <span>{OCCASIONS[t].emoji}</span>
              {OCCASIONS[t].label}
            </button>
          ))}
        </div>
      </div>

      {/* Names — two fields for a couple, joined with ו */}
      <div style={{ animation: `fade-up 280ms ${ease} 80ms both` }}>
        <p className="text-sm font-semibold mb-1.5">של מי?</p>
        {meta.couple ? (
          <div className="grid grid-cols-2 gap-2.5">
            <input
              type="text"
              value={name1}
              onChange={(e) => setName1(e.target.value)}
              placeholder={meta.placeholder}
              aria-label="שם ראשון"
              className={inputCls}
            />
            <input
              type="text"
              value={name2}
              onChange={(e) => setName2(e.target.value)}
              placeholder={isAnniversary ? "אבא" : "יוסי"}
              aria-label="שם שני"
              className={inputCls}
            />
          </div>
        ) : (
          <input
            type="text"
            value={name1}
            onChange={(e) => setName1(e.target.value)}
            placeholder={meta.placeholder}
            aria-label="שם"
            className={inputCls}
          />
        )}
      </div>

      {/* Full date — the year matters here, unlike birthdays */}
      <div style={{ animation: `fade-up 280ms ${ease} 120ms both` }}>
        <p className="text-sm font-semibold mb-1.5">{isAnniversary ? "תאריך החתונה" : "תאריך"}</p>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label={isAnniversary ? "תאריך החתונה" : "תאריך"}
          className={inputCls}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {isAnniversary
            ? "חוזר כל שנה — ונספור בשבילך איזו שנה חוגגים"
            : "פעם אחת — לא יחזור בשנה הבאה"}
        </p>
      </div>

      {/* Time + venue — both optional */}
      <div className="grid grid-cols-[7.5rem_1fr] gap-2.5" style={{ animation: `fade-up 280ms ${ease} 160ms both` }}>
        <div>
          <p className="text-sm font-semibold mb-1.5">שעה</p>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="שעה"
            className={inputCls}
          />
        </div>
        <div>
          <p className="text-sm font-semibold mb-1.5">מקום</p>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="אולם, כתובת..."
            aria-label="מקום"
            className={inputCls}
          />
        </div>
      </div>

      {/* Gift — optional, and can be logged in Finance too */}
      <div style={{ animation: `fade-up 280ms ${ease} 200ms both` }}>
        <p className="text-sm font-semibold mb-1.5">
          מתנה ₪ <span className="font-normal text-muted-foreground">(לא חובה)</span>
        </p>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={gift}
          onChange={(e) => setGift(e.target.value)}
          placeholder="למשל 500"
          aria-label="סכום המתנה"
          className={inputCls}
        />
        {hasGift && !editing && (
          <div className="mt-2.5 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
            <span className="text-sm font-semibold">לרשום גם כהוצאה בכספים</span>
            <button
              type="button"
              role="switch"
              aria-checked={logExpense}
              aria-label="לרשום גם כהוצאה בכספים"
              onClick={() => setLogExpense((v) => !v)}
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                logExpense ? "bg-primary" : "bg-muted"
              )}
            >
              <span className={cn(
                "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                logExpense ? "translate-x-5" : "translate-x-0.5"
              )} />
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={busy || !names || !date}
        className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition-[transform,opacity] active:scale-[0.97] disabled:opacity-40"
        style={{ transitionTimingFunction: ease, transitionDuration: "160ms" }}
      >
        {busy ? "שומר..." : editing ? "שמור שינויים" : `הוסף ${meta.label} ${meta.emoji}`}
      </button>
    </form>
  );
}

// ── Event Form ────────────────────────────────────────────────────────────────

function EventForm({
  initialDay,
  editing,
}: {
  initialDay?: number | undefined;
  editing?: CalEvent | undefined;
}) {
  const navigate = useNavigate();
  const addEvent = useAddEvent();
  const updateEvent = useUpdateEvent();
  const leaveEdit = useLeaveEdit("/calendar");

  const defaultDate = editing
    ? eventDateISO(editing)
    : initialDay
      ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(initialDay).padStart(2, "0")}`
      : todayStr;
  const wasAllDay = editing?.time === "כל היום";

  const [title, setTitle] = useState(editing?.title ?? "");
  const [date, setDate] = useState(defaultDate);
  const [allDay, setAllDay] = useState(wasAllDay);
  const [time, setTime] = useState(editing && !wasAllDay ? editing.time : "09:00");
  const [endTime, setEndTime] = useState(editing?.end_time ?? "");
  const [location, setLocation] = useState(editing?.location ?? "");
  const [category, setCategory] = useState<string>(editing?.category ?? "work");
  // Repeats every year on the Hebrew date — a yahrzeit, a Hebrew anniversary
  const wasHebrew = !!editing && hasHebrewDate(editing);
  const [hebrew, setHebrew] = useState(wasHebrew);
  const [dateTouched, setDateTouched] = useState(false);
  const [error, setError] = useState("");
  const detected = detectOccasion(title);
  const busy = addEvent.isPending || updateEvent.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("נא להזין כותרת"); return; }
    if (!date) { setError("נא לבחור תאריך"); return; }
    setError("");

    const d = new Date(date + "T00:00:00");
    // Switched on: the Hebrew date of the chosen day. Already on and the date
    // untouched: keep what's stored (the original date, not this year's).
    const hebrewDate = hebrew
      ? (wasHebrew && !dateTouched ? {} : hebrewFieldsOf(d))
      : wasHebrew ? NO_HEBREW_DATE : {};

    if (editing) {
      try {
        await updateEvent.mutateAsync({
          id: editing.id,
          title: title.trim(),
          day: d.getDate(),
          month: d.getMonth() + 1,
          // Renamed into a שמחה: tag it as on add. Renamed out of one: untag it,
          // or it would stay on the occasions page (and stuck to one year).
          ...(detected
            ? { occasion: detected, year: d.getFullYear() }
            : editing.occasion
              ? { occasion: null, year: null }
              : {}),
          time: allDay ? "כל היום" : time,
          end_time: (!allDay && endTime) ? endTime : null,
          location: location.trim() || null,
          category,
          ...hebrewDate,
        });
        leaveEdit();
      } catch (err) {
        setError(`השמירה נכשלה: ${(err as Error).message ?? "נסה שוב"}`);
      }
      return;
    }

    try {
      await addEvent.mutateAsync({
        title: title.trim(),
        day: d.getDate(),
        // Without month the event matched the same day in every month
        month: d.getMonth() + 1,
        // "החתונה של…" typed here is still a שמחה: tag it, and keep the year so
        // a wedding happens once instead of every year.
        ...(detected ? { occasion: detected, year: d.getFullYear() } : {}),
        time: allDay ? "כל היום" : time,
        end_time: (!allDay && endTime) ? endTime : null,
        location: location.trim() || null,
        category,
        is_birthday: false,
        ...hebrewDate,
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
          autoFocus={!editing}
        />
        {detected && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {OCCASIONS[detected].emoji} יופיע גם ברשימת השמחות ({OCCASIONS[detected].label})
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1.5">תאריך</label>
        <input
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setDateTouched(true); }}
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      <HebrewDateToggle
        on={hebrew}
        onChange={setHebrew}
        hint={
          hebrew && date
            ? `חוזר כל שנה ב${wasHebrew && !dateTouched && editing ? hebrewFieldsLabel(editing) : hebrewDateLabel(new Date(date + "T00:00:00"))}`
            : "חוזר כל שנה בתאריך העברי, למשל אזכרה"
        }
      />

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
        disabled={busy}
        className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground active:scale-95 transition disabled:opacity-60"
      >
        {busy ? "שומר..." : editing ? "שמור שינויים" : "שמור אירוע"}
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
  const { type, day, edit } = Route.useSearch();
  if (edit) return <EditEventPage id={edit} />;

  const title =
    type === "birthday" ? "הוסף יום הולדת" :
    type === "occasion" ? "הוסף שמחה" :
    type === "task" ? "משימה חדשה" :
    "אירוע חדש";

  return (
    <AppShell title={title}>
      {type === "task" ? (
        <TaskForm />
      ) : type === "birthday" ? (
        <BirthdayForm />
      ) : type === "occasion" ? (
        <OccasionForm />
      ) : (
        <EventForm initialDay={day} />
      )}
    </AppShell>
  );
}

/**
 * The same three forms, filled in from a saved event. Which one is decided by
 * the event itself, the way the lists sort them: a birthday by flag or title
 * (as useBirthdays), a שמחה by its stored type. Anything else — including an
 * occasion only detected from its title — is a free-text event.
 */
function EditEventPage({ id }: { id: string }) {
  const { data: events, isLoading } = useEvents();
  const event = events?.find((e) => e.id === id);

  const kind = !event
    ? null
    : event.is_birthday || /^\s*יום הולדת/.test(event.title)
      ? "birthday"
      : isOccasionType(event.occasion)
        ? "occasion"
        : "event";

  const title =
    kind === "birthday" ? "עריכת יום הולדת" :
    kind === "occasion" ? "עריכת שמחה" :
    "עריכת אירוע";

  return (
    <AppShell title={title}>
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="size-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : !event ? (
        <p className="py-16 text-center text-sm text-muted-foreground">האירוע לא נמצא — אולי הוא נמחק.</p>
      ) : kind === "birthday" ? (
        // key: a fresh form per event, so its state starts from that event
        <BirthdayForm key={event.id} editing={event} />
      ) : kind === "occasion" ? (
        <OccasionForm key={event.id} editing={event} />
      ) : (
        <EventForm key={event.id} editing={event} />
      )}
    </AppShell>
  );
}
