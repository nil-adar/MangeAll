import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, ChevronLeft, X } from "lucide-react";
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
    workDays.filter((d) => d.date.startsWith(ym)).map((d) => [d.date, d.status] as const)
  );

  const counts: Record<WorkStatus, number> = { office: 0, home: 0, off: 0, sick: 0, absent: 0 };
  byDate.forEach((status) => {
    counts[status]++;
  });
  const workedDays = WORK_STATUS_ORDER.filter(isWorkedStatus).reduce((n, s) => n + counts[s], 0);

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  function dateStr(day: number) {
    return `${displayYear}-${String(displayMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function dayLabel(day: number) {
    if (isCurrentMonth && day === todayDate) return "היום";
    const d = new Date(displayYear, displayMonth, day);
    return d.toLocaleDateString("he-IL", { weekday: "short", day: "numeric" });
  }

  return (
    <AppShell title="יומן ימי עבודה">
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

      {/* Day-by-day list — tap a day to set/change/clear its status */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="size-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <ul className="space-y-2 pb-10">
          {days.map((day) => {
            const date = dateStr(day);
            const status = byDate.get(date);
            const isOpen = openDay === date;
            return (
              <li key={date} className="surface-card rounded-2xl p-3.5">
                <button
                  type="button"
                  onClick={() => setOpenDay(isOpen ? null : date)}
                  className="flex w-full items-center justify-between"
                >
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      isCurrentMonth && day === todayDate && "text-primary"
                    )}
                  >
                    {dayLabel(day)}
                  </span>
                  {status ? (
                    <WorkStatusChip status={status} />
                  ) : (
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                      לא צוין
                    </span>
                  )}
                </button>

                {isOpen && (
                  <div className="mt-3.5 border-t border-border pt-3.5">
                    <WorkStatusButtons
                      value={status}
                      disabled={setWorkDay.isPending}
                      onSelect={(s) => {
                        setWorkDay.mutate({ date, status: s });
                        setOpenDay(null);
                      }}
                    />
                    {status && (
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
    </AppShell>
  );
}
