import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, MapPin, ArrowLeft, Cake, CheckCircle2, Circle, TrendingUp, CalendarDays, ListChecks } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useBirthdays } from "@/components/BirthdayList";
import { useScope, inScope } from "@/lib/scope";
import { useTasks, useEvents, useExpenses, useToggleTask, useMonthlyBudget, getCat, occursOn, isThisMonth, useWorkDays, useSetWorkDay, todayISO, isWorkedStatus } from "@/lib/queries";
import { WorkStatusButtons, WorkStatusChip } from "@/components/WorkDayPicker";
import { shekel, DEFAULT_MONTHLY_BUDGET } from "@/lib/config";
import { taskBucket, daysLate, lateLabel, BUCKET_LABEL, BUCKET_ORDER } from "@/lib/task-status";
import { useState, useEffect, useRef } from "react";

// taste-skill: strong ease-out for all transitions
const ease = "cubic-bezier(0.23, 1, 0.32, 1)";
const todayDay = new Date().getDate();
const todayMonth = new Date().getMonth() + 1; // 1-12, matching CalEvent.month

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "נהל הכל – היום שלך במבט אחד" },
      {
        name: "description",
        content:
          "אפליקציה בעברית לניהול אישי פשוט: לוח זמנים, משימות, אירועים והוצאות – הכול במקום אחד.",
      },
      { property: "og:title", content: "נהל הכל – היום שלך במבט אחד" },
      {
        property: "og:description",
        content: "לוח זמנים, משימות, אירועים והוצאות בממשק עברי פשוט להתקנה בנייד.",
      },
    ],
  }),
  component: Today,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "בוקר טוב";
  if (h < 17) return "צהריים טובים";
  if (h < 21) return "ערב טוב";
  return "לילה טוב";
}

function dayLabel(day: number, month: number) {
  const now = new Date();
  // A month earlier than the current one belongs to next year (Dec -> Jan)
  const year = month < now.getMonth() + 1 ? now.getFullYear() + 1 : now.getFullYear();
  const d = new Date(year, month - 1, day);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((d.getTime() - startOfToday.getTime()) / 86_400_000);

  if (diff === 0) return "היום";
  if (diff === 1) return "מחר";
  return d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "short" });
}

/**
 * Count-up on a numeric value.
 *
 * Interpolates from whatever is currently on screen to `target`, every time
 * `target` changes. The previous version latched with a `started` ref on first
 * mount — which fired while the expenses query was still pending, animated
 * 0 -> 0, and then refused to run again once the real total arrived, so the
 * card read "0" forever.
 *
 * rAF rather than CSS because the value is dynamic and interruptible: a second
 * change mid-flight retargets from the current number instead of snapping.
 */
function useCountUp(target: number, duration = 700, delay = 120) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;

    // prefers-reduced-motion: the global CSS block can't reach a rAF loop,
    // so honour it here — land on the value without the travel.
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const timeout = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = Math.round(from + (target - from) * eased);
        fromRef.current = current;
        setValue(current);
        if (progress < 1) frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    }, delay);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration, delay]);

  return value;
}

function Today() {
  const { scope } = useScope();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses();
  const { data: monthlyBudget = DEFAULT_MONTHLY_BUDGET } = useMonthlyBudget();
  const toggle = useToggleTask();
  const { birthdays } = useBirthdays();
  const { data: workDays = [] } = useWorkDays();
  const setWorkDay = useSetWorkDay();
  const today = todayISO();
  const todayStatus = workDays.find((d) => d.date === today)?.status ?? null;
  const [editingToday, setEditingToday] = useState(false);
  const workedDaysThisMonth = workDays.filter(
    (d) => isThisMonth(d.date) && isWorkedStatus(d.status)
  ).length;

  // Prefer what's imminent, but never show an empty card: if nothing falls in
  // the next 30 days, show the nearest ones anyway. (Birthdays with no month
  // carry a 999 sentinel and are skipped — they have no real date to count to.)
  const datedBirthdays = birthdays.filter((b) => b.daysUntil < 900);
  const soonBirthdays = datedBirthdays.filter((b) => b.daysUntil <= 30);
  const upcomingBirthdays = (soonBirthdays.length ? soonBirthdays : datedBirthdays).slice(0, 3);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const isLoading = tasksLoading || eventsLoading || expensesLoading;

  const scopedEvents = events.filter((e) => inScope(e.category, scope));
  const scopedTasks = tasks.filter((t) => inScope(t.category, scope));

  const next = scopedEvents.find((e) => occursOn(e, todayDay, todayMonth));

  // The next 7 dates, resolved through Date so the week survives a month
  // boundary — `day + 6` used to run past the end of the month (31 -> 37).
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return { day: d.getDate(), month: d.getMonth() + 1 };
  });

  const weekSlots = weekDates
    .map(({ day, month }) => ({
      day,
      month,
      items: scopedEvents
        .filter((e) => occursOn(e, day, month))
        .sort((a, b) => a.time.localeCompare(b.time)),
    }))
    .filter((slot) => slot.items.length > 0);

  const weekEventCount = weekSlots.reduce((n, s) => n + s.items.length, 0);
  const priorityRank = { גבוהה: 0, רגילה: 1, נמוכה: 2 } as const;
  // `due` is a label fixed at creation, so it can't age on its own: a task
  // made days ago with due="היום" kept claiming today. taskBucket() combines
  // it with created_at, which is what moves a stale task into "באיחור".
  const openTasks = [...scopedTasks]
    .filter((t) => !t.done)
    .sort(
      (a, b) =>
        BUCKET_ORDER.indexOf(taskBucket(a)) - BUCKET_ORDER.indexOf(taskBucket(b)) ||
        daysLate(b) - daysLate(a) ||
        priorityRank[a.priority] - priorityRank[b.priority],
    );
  const taskGroups = BUCKET_ORDER
    .map((bucket) => ({
      bucket,
      label: BUCKET_LABEL[bucket],
      items: openTasks.filter((t) => taskBucket(t) === bucket),
    }))
    .filter((g) => g.items.length > 0);

  // Must match the calculation in /finance exactly, or the two pages disagree:
  // one-off spend + monthly recurring + yearly amortised over 12.
  const oneTimeTotal = expenses
    // Same rule as /finance: one-time spend resets on the 1st of the month
    .filter((e) => (!e.repeat || e.repeat === "once") && isThisMonth(e.date))
    .reduce((sum, e) => sum + e.amount, 0);
  const monthlyRecurringTotal = expenses
    .filter((e) => e.repeat === "monthly")
    .reduce((sum, e) => sum + e.amount, 0);
  const yearlyAsMonthly = expenses
    .filter((e) => e.repeat === "yearly")
    .reduce((sum, e) => sum + Math.round(e.amount / 12), 0);

  const monthlySpent = oneTimeTotal + monthlyRecurringTotal + yearlyAsMonthly;
  const percent = Math.min(100, Math.round((monthlySpent / monthlyBudget) * 100));
  const dateLabel = new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const countedSpent = useCountUp(monthlySpent);
  const todayTaskCount = openTasks.filter((t) => taskBucket(t) === "today").length;
  const lateTaskCount = openTasks.filter((t) => taskBucket(t) === "overdue").length;
  const urgentCount = openTasks.filter((t) => t.priority === "גבוהה").length;

  function handleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setTimeout(() => {
      toggle.mutate({ id, done: true });
    }, 350);
  }

  if (isLoading) {
    return (
      <AppShell title={greeting()} subtitle={dateLabel}>
        {/* taste-skill: skeletal shimmer, never circular spinners */}
        <div className="space-y-4 pt-2">
          {[100, 72, 88].map((w, i) => (
            <div
              key={i}
              className="h-5 rounded-xl bg-muted overflow-hidden"
              style={{ width: `${w}%`, animation: `shimmer 1.6s ${ease} ${i * 120}ms infinite` }}
            />
          ))}
          <div className="h-32 rounded-3xl bg-muted overflow-hidden" style={{ animation: `shimmer 1.6s ${ease} 200ms infinite` }} />
          <div className="h-24 rounded-3xl bg-muted overflow-hidden" style={{ animation: `shimmer 1.6s ${ease} 320ms infinite` }} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={greeting()} subtitle={dateLabel}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer-el {
          background: linear-gradient(90deg, var(--color-muted, #f1f5f9) 25%, color-mix(in oklch, var(--color-muted, #f1f5f9) 70%, white) 50%, var(--color-muted, #f1f5f9) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.6s linear infinite;
        }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pop-in {
          0%   { opacity: 0; transform: scale(0.84) translateY(8px); }
          65%  { transform: scale(1.04); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes grow-bar {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes check-bounce {
          0%   { transform: scale(0.5); opacity: 0; }
          55%  { transform: scale(1.18); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 color-mix(in oklch, var(--color-primary, #6366f1) 40%, transparent); }
          70%  { box-shadow: 0 0 0 10px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }

        /* taste-skill: staggered cascade — 30–80ms per step */
        .stagger-list > li:nth-child(1)  { animation: fade-up 260ms ${ease} 20ms both; }
        .stagger-list > li:nth-child(2)  { animation: fade-up 260ms ${ease} 65ms both; }
        .stagger-list > li:nth-child(3)  { animation: fade-up 260ms ${ease} 110ms both; }
        .stagger-list > li:nth-child(4)  { animation: fade-up 260ms ${ease} 155ms both; }
        .stagger-list > li:nth-child(5)  { animation: fade-up 260ms ${ease} 200ms both; }
        .stagger-list > li:nth-child(n+6){ animation: fade-up 260ms ${ease} 230ms both; }

        .stat-chip { animation: pop-in 380ms ${ease} both; }
        .stat-chip:nth-child(1) { animation-delay: 60ms; }
        .stat-chip:nth-child(2) { animation-delay: 110ms; }
        .stat-chip:nth-child(3) { animation-delay: 160ms; }

        /* Hero card glow — radial from right edge (RTL) */
        .hero-glow::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: radial-gradient(ellipse at 90% 40%, oklch(from var(--color-primary, #6366f1) l c h / 0.07) 0%, transparent 65%);
          pointer-events: none;
        }

        /* Task leaving animation */
        .task-leaving {
          opacity: 0 !important;
          transform: translateX(-14px) scale(0.96) !important;
        }

        /* Section divider accent */
        .section-accent {
          display: inline-block;
          width: 3px;
          height: 1em;
          background: var(--color-primary, #6366f1);
          border-radius: 2px;
          vertical-align: middle;
          margin-left: 8px;
          opacity: 0.8;
        }
      `}</style>

      <div className="space-y-7 pb-10">

        {/* ── Daily work-status question ── */}
        <section
          className="surface-card rounded-3xl p-5"
          style={{ animation: `fade-up 280ms ${ease} 10ms both` }}
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="eyebrow">איפה עבדת היום?</p>
            <Link
              to="/workday"
              className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-primary transition-[transform,opacity] duration-[140ms] active:scale-[0.90]"
              style={{ transitionTimingFunction: ease }}
            >
              יומן
              <ArrowLeft className="size-3" />
            </Link>
          </div>

          {todayStatus && !editingToday ? (
            <div>
              <div className="flex items-center justify-between">
                <WorkStatusChip status={todayStatus} />
                <button
                  type="button"
                  onClick={() => setEditingToday(true)}
                  className="text-xs font-bold text-muted-foreground transition-colors duration-150 hover-fine:hover:text-primary"
                >
                  שינוי
                </button>
              </div>
              <p className="mt-3.5 text-xs text-muted-foreground">
                עבדת <span className="font-bold text-foreground">{workedDaysThisMonth}</span> ימים החודש
              </p>
            </div>
          ) : (
            <WorkStatusButtons
              value={todayStatus}
              disabled={setWorkDay.isPending}
              onSelect={(status) => {
                setWorkDay.mutate({ date: today, status });
                setEditingToday(false);
              }}
            />
          )}
        </section>

        {/* ── Stat chips ── */}
        {(todayTaskCount > 0 || lateTaskCount > 0 || urgentCount > 0 || weekEventCount > 0) && (
          <div
            className="flex gap-2 flex-wrap"
            style={{ animation: `fade-up 280ms ${ease} 0ms both` }}
          >
            {todayTaskCount > 0 && (
              <span className="stat-chip flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-primary uppercase">
                <ListChecks className="size-3.5 shrink-0" />
                {todayTaskCount} להיום
              </span>
            )}
            {lateTaskCount > 0 && (
              <span className="stat-chip flex items-center gap-1.5 rounded-full bg-destructive/10 px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-destructive uppercase">
                <TrendingUp className="size-3.5 shrink-0" />
                {lateTaskCount} באיחור
              </span>
            )}
            {urgentCount > 0 && (
              <span className="stat-chip flex items-center gap-1.5 rounded-full bg-red-500/10 px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-red-500 uppercase">
                <TrendingUp className="size-3.5 shrink-0" />
                {urgentCount} דחופות
              </span>
            )}
            {weekEventCount > 0 && (
              <span className="stat-chip flex items-center gap-1.5 rounded-full bg-muted px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                <CalendarDays className="size-3.5 shrink-0" />
                {weekEventCount} השבוע
              </span>
            )}
          </div>
        )}

        {/* ── Next event hero card ── taste-skill: strong visual hierarchy, asymmetric layout */}
        {next && (
          <section
            className="hero-glow surface-card relative overflow-hidden rounded-3xl p-5"
            style={{ animation: `fade-up 300ms ${ease} 40ms both` }}
          >
            {/* Right accent bar — thicker for visual weight */}
            <span className="absolute inset-y-0 right-0 w-1 bg-primary rounded-r-3xl" />

            {/* Pulsing live dot */}
            <span
              className="absolute left-5 top-5 size-2 rounded-full bg-primary"
              style={{ animation: "pulse-ring 2.2s ease infinite" }}
            />

            <p className="eyebrow pr-1">הבא בתור</p>

            {/* taste-skill: weight-driven hierarchy — title gets bold weight, generous leading */}
            <h2 className="mt-2 text-[1.45rem] font-extrabold leading-[1.2] tracking-tight pr-1">
              {next.title}
            </h2>

            <div className="mt-3.5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="size-4 text-primary shrink-0" />
                <span className="tabular-nums font-semibold text-foreground">
                  {next.time}
                  {next.end_time ? `–${next.end_time}` : ""}
                </span>
              </span>
              {next.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4 text-primary shrink-0" />
                  <span className="font-medium">{next.location}</span>
                </span>
              )}
            </div>
          </section>
        )}

        {/* ── Upcoming birthdays ── from the same list as /birthdays ── */}
        {upcomingBirthdays.length > 0 && (
          <section
            className="surface-card rounded-3xl p-5"
            style={{ animation: `fade-up 280ms ${ease} 60ms both` }}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="eyebrow flex items-center gap-1.5">
                <Cake className="size-3.5 text-primary" />
                ימי הולדת קרובים
              </p>
              <Link
                to="/birthdays"
                className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-primary transition-[transform,opacity] duration-[140ms] active:scale-[0.90]"
                style={{ transitionTimingFunction: ease }}
              >
                הכול
                <ArrowLeft className="size-3" />
              </Link>
            </div>

            <ul className="space-y-2.5 stagger-list">
              {upcomingBirthdays.map((b) => {
                const name = b.title.replace(/^\s*יום הולדת\s*(של\s*|ל)?/, "").trim() || b.title;
                const today = b.daysUntil === 0;
                const soon = b.daysUntil <= 7;
                return (
                  <li key={b.id} className="flex items-center gap-3">
                    <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {today ? <Cake className="size-4" /> : name.charAt(0)}
                      {today && (
                        <span
                          className="absolute inset-0 rounded-full"
                          style={{ animation: "pulse-ring 2.2s ease infinite" }}
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{name}</span>
                    <span
                      className={`shrink-0 text-xs font-bold ${
                        today ? "text-primary" : soon ? "text-amber-500" : "text-muted-foreground"
                      }`}
                    >
                      {today
                        ? "היום"
                        : b.daysUntil === 1
                          ? "מחר"
                          : b.daysUntil <= 60
                            ? `בעוד ${b.daysUntil} ימים`
                            : `בעוד כ-${Math.round(b.daysUntil / 30)} חודשים`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ── Tasks section ── */}
        <section style={{ animation: `fade-up 280ms ${ease} 80ms both` }}>
          <SectionTitle title="משימות" to="/tasks" />

          {taskGroups.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground pr-1">אין משימות פתוחות</p>
          ) : (
            <div className="mt-4 space-y-6">
              {taskGroups.map((g) => (
                <div key={g.label}>
                  {/* taste-skill: eyebrow with left accent bar */}
                  <p className="eyebrow mb-3 flex items-center gap-1.5">
                    <span
                      className="section-accent"
                      style={g.bucket === "overdue" ? { background: "var(--destructive)" } : undefined}
                    />
                    <span className={g.bucket === "overdue" ? "font-bold text-destructive" : undefined}>
                      {g.label}
                    </span>
                  </p>
                  <ul className="space-y-2 stagger-list">
                    {g.items.map((t) => {
                      const cat = getCat(t.category);
                      const isChecked = checked.has(t.id);
                      return (
                        <li
                          key={t.id}
                          className={`surface-card flex items-center gap-3.5 rounded-2xl p-4 ${isChecked ? "task-leaving" : ""}`}
                          style={{ transition: `opacity 300ms ${ease}, transform 300ms ${ease}` }}
                        >
                          <button
                            onClick={() => !isChecked && handleCheck(t.id)}
                            disabled={isChecked}
                            className="shrink-0 transition-transform active:scale-[0.78] disabled:cursor-default"
                            style={{ transitionTimingFunction: ease, transitionDuration: "140ms" }}
                            aria-label="סמן כהושלם"
                          >
                            {isChecked ? (
                              <CheckCircle2
                                className="size-5 fill-primary text-primary-foreground"
                                style={{ animation: `check-bounce 300ms ${ease} both` }}
                              />
                            ) : (
                              <Circle className="size-5 text-border hover:text-primary transition-colors duration-150" />
                            )}
                          </button>

                          <span
                            className={`flex-1 text-sm font-semibold leading-snug transition-opacity duration-300 ${
                              isChecked ? "opacity-35 line-through" : ""
                            }`}
                          >
                            {t.title}
                          </span>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            {t.priority === "גבוהה" && (
                              <span className="text-[10px] font-bold text-red-500 leading-none tracking-wide uppercase">
                                דחופה
                              </span>
                            )}
                            {daysLate(t) > 0 ? (
                              <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-[10px] font-bold text-destructive">
                                {lateLabel(daysLate(t))}
                              </span>
                            ) : (
                              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cat.soft}`}>
                                {t.due}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Week schedule ── */}
        <section style={{ animation: `fade-up 280ms ${ease} 130ms both` }}>
          <SectionTitle title="לו&quot;ז השבוע" to="/calendar" />

          {weekSlots.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground pr-1">אין אירועים השבוע</p>
          ) : (
            <div className="mt-4 space-y-6">
              {weekSlots.map((slot) => (
                <div key={`${slot.month}-${slot.day}`}>
                  <p className="eyebrow mb-3 flex items-center gap-1.5">
                    <span className="section-accent" />
                    {dayLabel(slot.day, slot.month)}
                  </p>
                  {/* taste-skill: timeline with right border — uses natural RTL flow */}
                  <ol className="space-y-0.5 border-r-2 border-border/50 pr-4 stagger-list">
                    {slot.items
                      .map((e) => {
                        const cat = getCat(e.category);
                        return (
                          <li key={e.id} className="relative py-3">
                            <span
                              className={`absolute -right-[1.35rem] top-[1.15rem] size-2.5 rounded-full ring-[3px] ring-background ${cat.dot}`}
                            />
                            <div className="flex items-baseline gap-3">
                              <span className="text-sm font-bold tabular-nums text-primary w-11 shrink-0">
                                {e.time}
                              </span>
                              <span className="flex items-center gap-1.5 text-[15px] font-semibold leading-snug">
                                {e.is_birthday && <Cake className="size-4 text-primary shrink-0" />}
                                {e.title}
                              </span>
                            </div>
                            {e.location && (
                              <p className="mt-0.5 pr-14 text-xs text-muted-foreground">{e.location}</p>
                            )}
                          </li>
                        );
                      })}
                  </ol>
                </div>
              ))}
            </div>
          )}

          {/* taste-skill: asymmetric action pair (1.4fr / 1fr) — never two equal cards.
              Left: add a birthday. Right: entry point to the /birthdays list. */}
          <div className="mt-5 flex gap-2.5">
            <Link
              to="/event/new"
              search={{ type: "birthday", day: undefined }}
              className="flex flex-[1.4] items-center justify-center gap-2 rounded-2xl border border-dashed border-border/80 p-3.5 text-sm font-bold text-primary transition-[transform,background-color] duration-[140ms] active:scale-[0.97] active:bg-primary/5"
              style={{ transitionTimingFunction: ease }}
            >
              <Cake className="size-4 shrink-0" />
              הוספת יום הולדת
            </Link>
            <Link
              to="/birthdays"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-muted p-3.5 text-sm font-bold text-foreground transition-[transform,background-color] duration-[140ms] active:scale-[0.97] active:bg-border/60"
              style={{ transitionTimingFunction: ease }}
            >
              כל ימי ההולדת
              <ArrowLeft className="size-3.5 shrink-0" />
            </Link>
          </div>
        </section>

        {/* ── Tomorrow brief ── */}
        {(() => {
          // Resolve "tomorrow" through Date — todayDay + 1 breaks on the last
          // day of the month, and matched every month's Nth day besides.
          const t = new Date();
          t.setDate(t.getDate() + 1);
          const tomorrowEvents = scopedEvents
            .filter((e) => occursOn(e, t.getDate(), t.getMonth() + 1))
            .sort((a, b) => a.time.localeCompare(b.time));
          const tomorrowTasks = scopedTasks.filter(
            (t) => !t.done && (t.due.includes("מחר") || taskBucket(t) === "soon")
          );
          if (tomorrowEvents.length === 0 && tomorrowTasks.length === 0) return null;

          return (
            <section
              className="surface-card rounded-3xl p-5"
              style={{ animation: `fade-up 280ms ${ease} 170ms both` }}
            >
              <p className="eyebrow mb-4 flex items-center gap-1.5">
                <span className="section-accent" />
                מחר בקצרה
              </p>
              <div className="space-y-3">
                {tomorrowEvents.map((e) => {
                  const cat = getCat(e.category);
                  return (
                    <div key={e.id} className="flex items-center gap-3">
                      <span className={`size-2 rounded-full shrink-0 ${cat.dot}`} />
                      <span className="text-xs font-bold tabular-nums text-primary w-10 shrink-0">{e.time}</span>
                      <span className="text-sm font-semibold truncate flex-1">
                        {e.is_birthday && "🎂 "}{e.title}
                      </span>
                    </div>
                  );
                })}
                {tomorrowTasks.map((t) => {
                  return (
                    <div key={t.id} className="flex items-center gap-3">
                      <Circle className="size-3.5 text-border shrink-0" />
                      <span className="text-sm font-semibold truncate flex-1">{t.title}</span>
                      {t.priority === "גבוהה" && (
                        <span className="text-[10px] font-bold text-red-500 shrink-0 tracking-wide uppercase">דחופה</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {/* ── Budget card ── taste-skill: strong number hierarchy, animated bar */}
        <section
          className="surface-card rounded-3xl p-5"
          style={{ animation: `fade-up 280ms ${ease} 200ms both` }}
        >
          <div className="flex items-baseline justify-between mb-1">
            <p className="eyebrow">הוצאות החודש</p>
            <Link
              to="/finance"
              className="flex items-center gap-1 text-xs font-bold text-primary transition-[transform,opacity] duration-[140ms] active:scale-[0.90]"
              style={{ transitionTimingFunction: ease }}
            >
              לפירוט
              <ArrowLeft className="size-3" />
            </Link>
          </div>

          {/* taste-skill: display number gets weight-driven scale */}
          <p className="mt-2.5 text-[2rem] font-extrabold tabular-nums leading-none tracking-tight">
            ₪{countedSpent.toLocaleString("he-IL")}
            <span className="text-sm font-medium text-muted-foreground mr-1">
              / {shekel(monthlyBudget)}
            </span>
          </p>

          {/* Progress bar */}
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${
                percent >= 90 ? "bg-red-500" : percent >= 70 ? "bg-amber-500" : "bg-primary"
              }`}
              style={{
                width: `${percent}%`,
                transformOrigin: "right center",
                animation: `grow-bar 900ms ${ease} 500ms both`,
              }}
            />
          </div>

          <div className="mt-2.5 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              נותרו {shekel(monthlyBudget - monthlySpent)}
            </p>
            <p
              className={`text-xs font-bold tabular-nums ${
                percent >= 90 ? "text-red-500" : percent >= 70 ? "text-amber-500" : "text-primary"
              }`}
            >
              {percent}%
            </p>
          </div>
        </section>

      </div>
    </AppShell>
  );
}

function SectionTitle({ title, to }: { title: string; to: string }) {
  return (
    <div className="flex items-center justify-between">
      {/* taste-skill: weight contrast — bold title, clear visual scale */}
      <h2 className="text-[1.1rem] font-extrabold tracking-tight">{title}</h2>
      <Link
        to={to}
        className="flex items-center gap-1 text-[11px] font-bold text-primary uppercase tracking-wide transition-[transform,opacity] duration-[140ms] active:scale-[0.90]"
        style={{ transitionTimingFunction: ease }}
      >
        הכול
        <ArrowLeft className="size-3" />
      </Link>
    </div>
  );
}
