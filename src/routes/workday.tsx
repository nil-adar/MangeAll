import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, ChevronLeft, ChevronDown, X, Printer } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { WorkStatusButtons, WorkStatusChip } from "@/components/WorkDayPicker";
import {
  useWorkDays,
  useSetWorkDay,
  useClearWorkDay,
  isWorkedStatus,
  WORK_STATUS_LABEL,
  WORK_STATUS_ORDER,
  type WorkStatus,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/workday")({
  component: WorkdayPage,
});

const ease = "cubic-bezier(0.23, 1, 0.32, 1)";
const today = new Date();
const todayYear = today.getFullYear();
const todayMonth = today.getMonth();
const todayDate = today.getDate();
const todayMidnight = new Date(todayYear, todayMonth, todayDate).getTime();

// Fixed Hebrew weekday initials, Sun-Sat (matches Date#getDay()) — not
// locale output, so the label is identical on every browser/OS.
const WEEKDAY_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function WorkdayPage() {
  const { data: workDays = [], isLoading } = useWorkDays();
  const setWorkDay = useSetWorkDay();
  const clearWorkDay = useClearWorkDay();

  const [monthOffset, setMonthOffset] = useState(0);
  // The one row currently showing its status picker, if any.
  const [openDay, setOpenDay] = useState<string | null>(null);

  const displayDate = new Date(todayYear, todayMonth + monthOffset, 1);
  const displayMonth = displayDate.getMonth();
  const displayYear = displayDate.getFullYear();
  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
  const monthLabel = displayDate.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
  const isCurrentMonth = monthOffset === 0;

  const ym = `${displayYear}-${String(displayMonth + 1).padStart(2, "0")}`;
  const byDate = new Map(
    workDays
      .filter((d) => d.date.startsWith(ym))
      .map((d) => [d.date, { status: d.status, note: d.note }] as const)
  );

  const counts: Record<WorkStatus, number> = {
    office: 0,
    home: 0,
    off: 0,
    sick: 0,
    absent: 0,
    other: 0,
  };
  byDate.forEach(({ status }) => {
    counts[status]++;
  });
  const workedDays = WORK_STATUS_ORDER.filter(isWorkedStatus).reduce((n, s) => n + counts[s], 0);

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  function dateStr(day: number) {
    return `${displayYear}-${String(displayMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // Always the weekday+date form, even for today — the report is meant to be
  // read by someone else later, when "היום" would no longer mean anything.
  function fullDayLabel(day: number) {
    const weekday = WEEKDAY_SHORT[new Date(displayYear, displayMonth, day).getDay()];
    return `יום ${weekday} · ${day}.${displayMonth + 1}`;
  }

  function dayLabel(day: number) {
    if (isCurrentMonth && day === todayDate) return "היום";
    return fullDayLabel(day);
  }

  function isFuture(day: number) {
    return new Date(displayYear, displayMonth, day).getTime() > todayMidnight;
  }

  return (
    <AppShell title="יומן ימי עבודה">
      {/* Screen-only UI — swapped for a plain table when printing, see below */}
      <div className="print:hidden">
        {/* Month navigation — same left/right convention as /calendar */}
        <div className="mb-5 flex items-center justify-between">
          <button
            onClick={() => {
              setMonthOffset((m) => m + 1);
              setOpenDay(null);
            }}
            className="rounded-xl p-2 transition-[transform,background-color] duration-[160ms] active:scale-[0.88] active:bg-muted"
            style={{ transitionTimingFunction: ease }}
            aria-label="חודש הבא"
          >
            <ChevronLeft className="size-5 text-muted-foreground" />
          </button>
          <span className="text-sm font-bold">{monthLabel}</span>
          <button
            onClick={() => {
              setMonthOffset((m) => m - 1);
              setOpenDay(null);
            }}
            className="rounded-xl p-2 transition-[transform,background-color] duration-[160ms] active:scale-[0.88] active:bg-muted"
            style={{ transitionTimingFunction: ease }}
            aria-label="חודש קודם"
          >
            <ChevronRight className="size-5 text-muted-foreground" />
          </button>
        </div>

        {/* Monthly summary */}
        <section className="surface-card mb-6 rounded-3xl p-5">
          <p className="eyebrow mb-3">סיכום החודש</p>
          <p className="text-[2rem] font-extrabold leading-none tracking-tight tabular-nums">
            {workedDays}
            <span className="mr-1.5 text-sm font-medium text-muted-foreground">ימי עבודה</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {WORK_STATUS_ORDER.map(
              (s) =>
                counts[s] > 0 && (
                  <span
                    key={s}
                    className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground"
                  >
                    {WORK_STATUS_LABEL[s]} · {counts[s]}
                  </span>
                )
            )}
          </div>
        </section>

        <button
          type="button"
          onClick={() => window.print()}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-bold text-foreground transition-[transform,background-color] duration-150 active:scale-[0.98] hover-fine:hover:bg-muted"
          style={{ transitionTimingFunction: ease }}
        >
          <Printer className="size-4" />
          ייצוא דוח (הדפסה / PDF)
        </button>

        {/* Day-by-day list — tap a day to set/change/clear its status */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="size-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <ul className="space-y-2 pb-10">
            {days.map((day) => {
              const date = dateStr(day);
              const entry = byDate.get(date);
              const isOpen = openDay === date;
              const future = isFuture(day);
              return (
                <li key={date} className={cn("surface-card rounded-2xl p-3.5", future && "opacity-50")}>
                  <button
                    type="button"
                    disabled={future}
                    onClick={() => setOpenDay(isOpen ? null : date)}
                    className="flex w-full items-center justify-between gap-2 disabled:cursor-default"
                  >
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-sm font-semibold",
                        isCurrentMonth && day === todayDate && "text-primary"
                      )}
                    >
                      {dayLabel(day)}
                      {!future && (
                        <ChevronDown
                          className={cn(
                            "size-3.5 text-muted-foreground transition-transform duration-150",
                            isOpen && "rotate-180"
                          )}
                          style={{ transitionTimingFunction: ease }}
                        />
                      )}
                    </span>
                    {future ? (
                      <span className="text-xs text-muted-foreground/60">—</span>
                    ) : entry ? (
                      <WorkStatusChip status={entry.status} note={entry.note} />
                    ) : (
                      <span className="rounded-full border border-dashed border-primary/40 px-3 py-1 text-xs font-bold text-primary">
                        לא צוין
                      </span>
                    )}
                  </button>

                  {isOpen && !future && (
                    <div className="mt-3.5 border-t border-border pt-3.5">
                      <WorkStatusButtons
                        value={entry?.status}
                        valueNote={entry?.note}
                        disabled={setWorkDay.isPending}
                        onSelect={(s, note) => {
                          setWorkDay.mutate({ date, status: s, note });
                          setOpenDay(null);
                        }}
                      />
                      {entry && (
                        <button
                          type="button"
                          onClick={() => {
                            clearWorkDay.mutate(date);
                            setOpenDay(null);
                          }}
                          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-muted-foreground transition-colors duration-150 hover-fine:hover:text-destructive"
                        >
                          <X className="size-3.5" />
                          נקה
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Print-only report — clean, print-safe layout instead of the app chrome */}
      <div className="hidden print:block">
        <div className="mb-5 flex items-start justify-between border-b-2 border-black pb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              נהל הכל
            </p>
            <h1 className="text-2xl font-extrabold leading-tight">דוח ימי עבודה</h1>
            <p className="text-sm text-muted-foreground">{monthLabel}</p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            הופק ב-{new Date().toLocaleDateString("he-IL")}
          </p>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          <span className="font-extrabold">סה"כ ימי עבודה: {workedDays}</span>
          {WORK_STATUS_ORDER.map(
            (s) =>
              counts[s] > 0 && (
                <span key={s} className="text-muted-foreground">
                  {WORK_STATUS_LABEL[s]}: <span className="font-bold text-foreground">{counts[s]}</span>
                </span>
              )
          )}
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black text-right">
              <th className="py-2 pr-1">תאריך</th>
              <th className="py-2">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const entry = byDate.get(dateStr(day));
              return (
                <tr key={day} className="border-b border-black/15">
                  <td className="py-1.5 pr-1">{fullDayLabel(day)}</td>
                  <td className="py-1.5">
                    {entry
                      ? entry.status === "other" && entry.note
                        ? entry.note
                        : WORK_STATUS_LABEL[entry.status]
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
