import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, MapPin, ArrowLeft, Cake, CheckCircle2, Circle, TrendingUp, CalendarDays, ListChecks, Check, X, PartyPopper } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useBirthdays } from "@/components/BirthdayList";
import { EventTypeIcon, useOccasions } from "@/components/OccasionList";
import { TipsCard } from "@/components/TipsCard";
import { IncomingInvites } from "@/components/HouseholdInvites";
import { NO_DATE, OCCASIONS, occasionOf } from "@/lib/occasions";
import { useScope, inScope } from "@/lib/scope";
import { useTasks, useEvents, useExpenses, useToggleTask, useMonthlyBudget, getCat, occursOn, isThisMonth, useWorkDays, useSetWorkDay, todayISO, isWorkedStatus, useShoppingItems, useHousehold, useProfile } from "@/lib/queries";
import { getHistory } from "@/lib/shopping-smart";
import { WorkStatusButtons, WorkStatusChip } from "@/components/WorkDayPicker";
import { shekel, DEFAULT_MONTHLY_BUDGET } from "@/lib/config";
import { taskBucket, daysLate, lateLabel, BUCKET_LABEL, BUCKET_ORDER } from "@/lib/task-status";
import { useState, useEffect, useRef } from "react";

// taste-skill: strong ease-out for all transitions
const ease = "cubic-bezier(0.23, 1, 0.32, 1)";
const todayDay = new Date().getDate();
const todayMonth = new Date().getMonth() + 1; // 1-12, matching CalEvent.month
const todayYear = new Date().getFullYear();

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

/** "בוקר טוב, נועה": first name only, and just the greeting until there is one. */
function greetingFor(name: string | null | undefined) {
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${greeting()}, ${first}` : greeting();
}

/** The header's subtitle: today's plan, or tomorrow's once the day is over (21:00). */
function planLabel() {
  const now = new Date();
  const late = now.getHours() >= 21;
  const day = late ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) : now;
  const date = day.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
  return late ? `מה הלו״ז מחר? · ${date}` : `אז מה הלו״ז היום? · ${date}`;
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
  const { data: profile } = useProfile();
  const toggle = useToggleTask();
  const { birthdays } = useBirthdays();
  const { data: workDays = [] } = useWorkDays();
  const { data: shoppingItems = [], isLoading: shoppingLoading } = useShoppingItems();
  const { data: household, isLoading: householdLoading } = useHousehold();
  const setWorkDay = useSetWorkDay();
  const today = todayISO();
  const todayEntry = workDays.find((d) => d.date === today);
  const todayStatus = todayEntry?.status ?? null;
  const todayNote = todayEntry?.note ?? null;
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
  // Next three that haven't happened yet; the card hides when there are none.
  const { upcoming: occasions } = useOccasions();
  const upcomingOccasions = occasions.filter((o) => o.daysUntil !== NO_DATE).slice(0, 3);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const isLoading = tasksLoading || eventsLoading || expensesLoading;

  const scopedEvents = events.filter((e) => inScope(e.category, scope));
  const scopedTasks = tasks.filter((t) => inScope(t.category, scope));

  const next = scopedEvents.find((e) => occursOn(e, todayDay, todayMonth, todayYear));

  // The next 7 dates, resolved through Date so the week survives a month
  // boundary — `day + 6` used to run past the end of the month (31 -> 37).
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
  });

  const weekSlots = weekDates
    .map(({ day, month, year }) => ({
      day,
      month,
      items: scopedEvents
        .filter((e) => occursOn(e, day, month, year))
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
  const headerTitle = greetingFor(profile?.display_name);
  const headerSubtitle = planLabel();

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
      <AppShell title={headerTitle} subtitle={headerSubtitle}>
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
    <AppShell title={headerTitle} subtitle={headerSubtitle}>
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

        {/* An invite to a shared list waits here until answered */}
        <IncomingInvites className="space-y-3" />

        <GettingStarted
          ready={!shoppingLoading && !eventsLoading && !householdLoading}
          done={{
            // A list that was bought and cleared still counts as started
            shopping: shoppingItems.length > 0 || Object.keys(getHistory()).length > 0,
            birthday: birthdays.length > 0,
            // A share code exists once the list is shared (or joined)
            share: household != null,
          }}
        />

        <TipsCard />

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
              כל החודש
              <ArrowLeft className="size-3" />
            </Link>
          </div>

          {todayStatus && !editingToday ? (
            <div>
              <div className="flex items-center justify-between">
                <WorkStatusChip status={todayStatus} note={todayNote} />
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
              valueNote={todayNote}
              disabled={setWorkDay.isPending}
              onSelect={(status, note) => {
                setWorkDay.mutate({ date: today, status, note });
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

            {/* Stretched over the card: tapping anywhere on it opens the edit form */}
            <Link
              to="/event/new"
              search={{ type: "event", edit: next.id }}
              aria-label={`עריכת ${next.title}`}
              className="absolute inset-0 z-10 rounded-3xl"
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

        {/* ── Upcoming occasions (שמחות) ── from the same list as /occasions ── */}
        {upcomingOccasions.length > 0 && (
          <section
            className="surface-card rounded-3xl p-5"
            style={{ animation: `fade-up 280ms ${ease} 70ms both` }}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="eyebrow flex items-center gap-1.5">
                <PartyPopper className="size-3.5 text-primary" />
                שמחות קרובות
              </p>
              <Link
                to="/occasions"
                className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-primary transition-[transform,opacity] duration-[140ms] active:scale-[0.90]"
                style={{ transitionTimingFunction: ease }}
              >
                הכול
                <ArrowLeft className="size-3" />
              </Link>
            </div>

            <ul className="space-y-2.5 stagger-list">
              {upcomingOccasions.map((o) => {
                const today = o.daysUntil === 0;
                const soon = o.daysUntil <= 7;
                return (
                  <li key={o.id} className="flex items-center gap-3">
                    <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base">
                      {OCCASIONS[o.type].emoji}
                      {today && (
                        <span
                          className="absolute inset-0 rounded-full"
                          style={{ animation: "pulse-ring 2.2s ease infinite" }}
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">
                      {o.title}
                      {o.yearNumber != null && (
                        <span className="mr-1.5 text-xs font-semibold text-muted-foreground">· שנה {o.yearNumber}</span>
                      )}
                    </span>
                    <span
                      className={`shrink-0 text-xs font-bold ${
                        today ? "text-primary" : soon ? "text-amber-500" : "text-muted-foreground"
                      }`}
                    >
                      {today
                        ? "היום"
                        : o.daysUntil === 1
                          ? "מחר"
                          : o.daysUntil <= 60
                            ? `בעוד ${o.daysUntil} ימים`
                            : `בעוד כ-${Math.round(o.daysUntil / 30)} חודשים`}
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
            <EmptyHint text="אין משימות פתוחות" action="הוספת משימה" to="/event/new" search={{ type: "task" }} />
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
            <EmptyHint text="אין אירועים השבוע" action="הוספת אירוע" to="/event/new" search={{ type: "event" }} />
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
                            <Link to="/event/new" search={{ type: "event", edit: e.id }} className="block">
                              <div className="flex items-baseline gap-3">
                                <span className="text-sm font-bold tabular-nums text-primary w-11 shrink-0">
                                  {e.time}
                                </span>
                                <span className="flex items-center gap-1.5 text-[15px] font-semibold leading-snug">
                                  <EventTypeIcon e={e} className="size-4 text-primary shrink-0" />
                                  {e.title}
                                </span>
                              </div>
                              {e.location && (
                                <p className="mt-0.5 pr-14 text-xs text-muted-foreground">{e.location}</p>
                              )}
                            </Link>
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
            .filter((e) => occursOn(e, t.getDate(), t.getMonth() + 1, t.getFullYear()))
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
                  const occasion = occasionOf(e);
                  return (
                    <Link key={e.id} to="/event/new" search={{ type: "event", edit: e.id }} className="flex items-center gap-3">
                      <span className={`size-2 rounded-full shrink-0 ${cat.dot}`} />
                      <span className="text-xs font-bold tabular-nums text-primary w-10 shrink-0">{e.time}</span>
                      <span className="text-sm font-semibold truncate flex-1">
                        {e.is_birthday ? "🎂 " : occasion ? `${OCCASIONS[occasion].emoji} ` : ""}{e.title}
                      </span>
                    </Link>
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

// ── First-run guide ──────────────────────────────────────────────────────────
// A new account opens to empty sections, which says nothing about what the app
// is for. Four short steps, ordered by value: shopping and sharing first,
// since that's where the app sets itself apart. Each step ticks itself off
// once it has data, and the card goes away when every step is done or the
// user hides it.

const ONBOARDING_KEY = "nahel-hakol:onboarding-dismissed";

type StepKey = "account" | "shopping" | "birthday" | "share";

const STEPS: Array<{
  key: StepKey;
  title: string;
  /** The verb on the step's end — what tapping it does. None: nothing to do. */
  action?: string;
  to?: string;
  search?: Record<string, string | number>;
}> = [
  { key: "account", title: "יצירת חשבון" },
  { key: "shopping", title: "רשימת קניות ראשונה", action: "להתחיל", to: "/shopping" },
  { key: "birthday", title: "יום הולדת שלא כדאי לשכוח", action: "להוסיף", to: "/event/new", search: { type: "birthday" } },
  // share=1 opens the share sheet straight away (see routes/shopping.tsx)
  { key: "share", title: "הזמנת בן/בת הזוג לרשימה", action: "להזמין", to: "/shopping", search: { share: 1 } },
];

function GettingStarted({ ready, done }: { ready: boolean; done: Record<Exclude<StepKey, "account">, boolean> }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_KEY) === "1";
    } catch {
      return false;
    }
  });

  // Being here means the account exists, so that step is always done.
  const isDone = (key: StepKey) => key === "account" || done[key];
  const count = STEPS.filter((s) => isDone(s.key)).length;
  if (!ready || dismissed || count === STEPS.length) return null;

  function dismiss() {
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      /* storage blocked — hidden for this visit only */
    }
    setDismissed(true);
  }

  return (
    <section
      className="surface-card rounded-3xl p-5"
      style={{ animation: `fade-up 280ms ${ease} both` }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[1.05rem] font-extrabold tracking-tight">
          צעדים ראשונים · {count} מתוך {STEPS.length}
        </h2>
        <button
          type="button"
          onClick={dismiss}
          aria-label="הסתרת הצעדים הראשונים"
          className="-me-1.5 flex size-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors duration-150 hover-fine:hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${(count / STEPS.length) * 100}%`, transitionTimingFunction: ease }}
        />
      </div>

      <ul className="mt-3 space-y-0.5">
        {STEPS.map((s) => {
          const stepDone = isDone(s.key);
          const row = (
            <>
              <span
                className={`flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
                  stepDone ? "border-success bg-success text-white" : "border-border"
                }`}
              >
                {stepDone && <Check className="size-3" strokeWidth={3.5} />}
              </span>
              <span className={`min-w-0 flex-1 text-sm font-bold ${stepDone ? "text-muted-foreground line-through" : ""}`}>
                {s.title}
              </span>
              {!stepDone && s.action && (
                <span className="shrink-0 text-xs font-extrabold text-primary">{s.action}</span>
              )}
            </>
          );
          return (
            <li key={s.key}>
              {stepDone || !s.to ? (
                <div className="flex items-center gap-2.5 px-2 py-2.5">{row}</div>
              ) : (
                <Link
                  to={s.to}
                  search={s.search as never}
                  className="flex items-center gap-2.5 rounded-xl px-2 py-2.5 transition-[transform,background-color] duration-[140ms] active:scale-[0.98] hover-fine:hover:bg-muted"
                  style={{ transitionTimingFunction: ease }}
                >
                  {row}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Empty section that says what to do next, not just that there's nothing. */
function EmptyHint({
  text,
  action,
  to,
  search,
}: {
  text: string;
  action: string;
  to: string;
  search: Record<string, string>;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border/80 px-4 py-3.5">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Link
        to={to}
        search={search as never}
        className="shrink-0 text-xs font-bold text-primary transition-transform duration-[140ms] active:scale-[0.94]"
        style={{ transitionTimingFunction: ease }}
      >
        + {action}
      </Link>
    </div>
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
