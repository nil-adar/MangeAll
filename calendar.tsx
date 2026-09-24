import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarPlus, Clock, MapPin, Cake, Sparkles, ChevronRight, ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useEvents, getCat } from "@/lib/queries";
import { events as demoEvents } from "@/lib/demo-data";
import { useScope, inScope } from "@/lib/scope";
import { cn } from "@/lib/utils";
import type { CalEvent } from "@/lib/queries";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});

const DAY_NAMES_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const today = new Date();
const todayDay = today.getDate();
const todayMonth = today.getMonth();
const todayYear = today.getFullYear();

function CalendarPage() {
  const { data: events = [], isLoading } = useEvents();
  const { scope } = useScope();

  // monthOffset: 0 = current month, 1 = next month, -1 = previous month, etc.
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(todayDay);

  const isEmpty = !isLoading && events.length === 0;
  const displayEvents: CalEvent[] = isEmpty
    ? demoEvents.map((e) => ({
        id: e.id,
        title: e.title,
        day: e.day,
        time: e.time,
        end_time: e.endTime ?? null,
        location: e.location ?? null,
        category: e.category,
        is_birthday: e.isBirthday ?? false,
        created_at: "",
      }))
    : events;

  // Scoped events
  const scopedEvents = displayEvents.filter((e) => inScope(e.category, scope));

  // Calculate displayed month
  const displayDate = new Date(todayYear, todayMonth + monthOffset, 1);
  const displayMonth = displayDate.getMonth();
  const displayYear = displayDate.getFullYear();
  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
  const firstDayOfWeek = displayDate.getDay(); // 0=Sun, 6=Sat — Hebrew calendar is Sun-Sat

  const monthLabel = displayDate.toLocaleDateString("he-IL", { month: "long", year: "numeric" });

  // Build the month grid cells (null = empty)
  const gridCells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to fill complete rows
  while (gridCells.length % 7 !== 0) gridCells.push(null);

  // Events for selected day
  const selectedDayEvents = selectedDay !== null
    ? scopedEvents
        .filter((e) => e.day === selectedDay)
        .sort((a, b) => a.time.localeCompare(b.time))
    : [];

  // Helper: does a day have events?
  const dayHasEvent = (d: number) => scopedEvents.some((e) => e.day === d);

  const isCurrentMonth = monthOffset === 0;
  const isPast = (d: number) => isCurrentMonth && d < todayDay;

  function dayLabel(day: number): string {
    if (isCurrentMonth && day === todayDay) return "היום";
    const d = new Date(displayYear, displayMonth, day);
    return d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
  }

  return (
    <AppShell title="לוח שנה">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => { setMonthOffset((m) => m + 1); setSelectedDay(null); }}
          className="rounded-xl p-2 hover:bg-muted active:bg-muted transition"
          aria-label="חודש הבא"
        >
          <ChevronLeft className="size-5 text-muted-foreground" />
        </button>
        <button
          onClick={() => { setMonthOffset(0); setSelectedDay(todayDay); }}
          className="text-sm font-bold text-foreground hover:text-primary transition"
        >
          {monthLabel}
        </button>
        <button
          onClick={() => { setMonthOffset((m) => m - 1); setSelectedDay(null); }}
          className="rounded-xl p-2 hover:bg-muted active:bg-muted transition"
          aria-label="חודש קודם"
        >
          <ChevronRight className="size-5 text-muted-foreground" />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1.5">
        {DAY_NAMES_SHORT.map((name) => (
          <div key={name} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
            {name}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 gap-y-1 mb-5">
        {gridCells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const isToday = isCurrentMonth && day === todayDay;
          const isSelected = day === selectedDay;
          const hasEvent = dayHasEvent(day);
          const past = isPast(day);
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day === selectedDay ? null : day)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition active:scale-95",
                isSelected && "bg-primary text-primary-foreground",
                !isSelected && isToday && "bg-primary/12 text-primary",
                !isSelected && !isToday && "hover:bg-muted",
                past && !isSelected && "opacity-40"
              )}
            >
              <span className={cn("text-sm font-bold", isSelected && "text-primary-foreground", !isSelected && isToday && "text-primary")}>
                {day}
              </span>
              {hasEvent && (
                <span className={cn("size-1.5 rounded-full", isSelected ? "bg-primary-foreground/70" : "bg-primary")} />
              )}
            </button>
          );
        })}
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
                <p className="text-xs text-muted-foreground mt-0.5">הוסף אירוע ראשון ודוגמאות אלו יעלמו</p>
              </div>
            </div>
          )}

          {/* Events for selected day */}
          {selectedDay !== null && (
            <div className="pb-24">
              <div className="flex items-center justify-between mb-3">
                <p className="eyebrow">{dayLabel(selectedDay)}</p>
                <Link
                  to="/event/new"
                  search={{ type: "event", day: String(selectedDay) }}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground active:scale-95 transition"
                >
                  <CalendarPlus className="size-3.5" />
                  הוסף אירוע
                </Link>
              </div>
              {selectedDayEvents.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-4 text-center text-muted-foreground">
                  <CalendarPlus className="size-8 opacity-30" />
                  <p className="text-sm">אין אירועים ביום זה</p>
                  <Link
                    to="/event/new"
                    search={{ type: "event", day: String(selectedDay) }}
                    className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground active:scale-95 transition"
                  >
                    <CalendarPlus className="size-4" />
                    הוסף אירוע ליום זה
                  </Link>
                </div>
              ) : (
                <ol className="space-y-2 border-r border-border/70 pr-4">
                  {selectedDayEvents.map((e) => {
                    const cat = getCat(e.category);
                    return (
                      <li
                        key={e.id}
                        className={cn("relative surface-card rounded-2xl p-3.5", isEmpty && "opacity-50")}
                      >
                        <span className={`absolute -right-[1.4rem] top-4 size-2.5 rounded-full ring-4 ring-background ${cat.dot}`} />
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold flex items-center gap-1.5">
                              {e.is_birthday && <Cake className="size-3.5 text-primary shrink-0" />}
                              {e.title}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                              {e.time !== "כל היום" && (
                                <span className="flex items-center gap-1">
                                  <Clock className="size-3 text-primary" />
                                  {e.time}{e.end_time ? `–${e.end_time}` : ""}
                                </span>
                              )}
                              {e.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="size-3 text-primary" />
                                  {e.location}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${cat.soft}`}>
                            {cat.label}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <Link
                  to="/event/new"
                  search={{ type: "event", day: String(selectedDay) }}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 py-2.5 text-sm font-semibold text-primary active:scale-95 transition"
                >
                  <CalendarPlus className="size-4" />
                  הוסף אירוע נוסף
                </Link>
              )}
            </div>
          )}

          {/* Show all upcoming when no day selected */}
          {selectedDay === null && (
            <div className="pb-24">
              {scopedEvents.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <CalendarPlus className="size-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">אין אירועים בחודש זה</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {[...new Set(scopedEvents.map((e) => e.day))].map((day) => (
                    <div key={day}>
                      <p className="eyebrow mb-2">{dayLabel(day)}</p>
                      <ol className="space-y-2 border-r border-border/70 pr-4">
                        {scopedEvents.filter((e) => e.day === day).map((e) => {
                          const cat = getCat(e.category);
                          return (
                            <li
                              key={e.id}
                              className={cn("relative surface-card rounded-2xl p-3.5", isEmpty && "opacity-50")}
                            >
                              <span className={`absolute -right-[1.4rem] top-4 size-2.5 rounded-full ring-4 ring-background ${cat.dot}`} />
                              <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold flex items-center gap-1.5">
                                    {e.is_birthday && <Cake className="size-3.5 text-primary shrink-0" />}
                                    {e.title}
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                                    {e.time !== "כל היום" && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="size-3 text-primary" />
                                        {e.time}{e.end_time ? `–${e.end_time}` : ""}
                                      </span>
                                    )}
                                    {e.location && (
                                      <span className="flex items-center gap-1">
                                        <MapPin className="size-3 text-primary" />
                                        {e.location}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${cat.soft}`}>
                                  {cat.label}
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Link
        to="/event/new"
        search={{ type: "event" }}
        className="fixed bottom-24 left-5 z-20 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition active:scale-95"
        aria-label="אירוע חדש"
      >
        <CalendarPlus className="size-5" />
      </Link>
    </AppShell>
  );
}
