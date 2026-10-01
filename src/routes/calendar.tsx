import { useState, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarPlus, Clock, MapPin, ChevronRight, ChevronLeft, Trash2 } from "lucide-react";
import { EventTypeIcon } from "@/components/OccasionList";
import { EditEventButton } from "@/components/EditEventButton";
import { Tip } from "@/components/Tip";
import { AppShell } from "@/components/AppShell";
import { useEvents, useDeleteEvent, getCat, occursOn, inMonth } from "@/lib/queries";
import { useScope, inScope } from "@/lib/scope";
import { cn } from "@/lib/utils";
import type { CalEvent } from "@/lib/queries";
import { getHolidaysForMonth, getHolidaysForDay } from "@/lib/holidays";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
});

const DAY_NAMES_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const HE_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];
const today = new Date();
const todayDay = today.getDate();
const todayMonth = today.getMonth();
const todayYear = today.getFullYear();

const ease = "cubic-bezier(0.23, 1, 0.32, 1)";

function CalendarPage() {
  const { data: events = [], isLoading } = useEvents();
  const { scope } = useScope();

  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(todayDay);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Touch swipe to change month
  const touchStartX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0]?.clientX ?? null; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX === undefined) return;
    const dx = endX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      // RTL: swipe right = previous month, swipe left = next month
      setMonthOffset((m) => m + (dx > 0 ? -1 : 1));
      setSelectedDay(null);
    }
    touchStartX.current = null;
  }

  const scopedEvents = events.filter((e) => inScope(e.category, scope));

  const displayDate = new Date(todayYear, todayMonth + monthOffset, 1);
  const displayMonth = displayDate.getMonth();
  const displayYear = displayDate.getFullYear();
  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
  const firstDayOfWeek = displayDate.getDay();

  const monthLabel = displayDate.toLocaleDateString("he-IL", { month: "long", year: "numeric" });

  const gridCells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (gridCells.length % 7 !== 0) gridCells.push(null);

  const monthHolidays = getHolidaysForMonth(displayYear, displayMonth + 1);

  // 1-12, matching how event.new.tsx writes the column
  const displayMonthNum = displayMonth + 1;

  // Everything that belongs to the month currently on screen
  const monthEvents = scopedEvents.filter((e) => inMonth(e, displayMonthNum, displayYear));

  const selectedDayEvents = selectedDay !== null
    ? scopedEvents
        .filter((e) => occursOn(e, selectedDay, displayMonthNum, displayYear))
        .sort((a, b) => a.time.localeCompare(b.time))
    : [];

  const selectedDayHolidays = selectedDay !== null
    ? getHolidaysForDay(displayYear, displayMonth + 1, selectedDay)
    : [];

  const dayHasEvent = (d: number) =>
    scopedEvents.some((e) => occursOn(e, d, displayMonthNum, displayYear));
  const dayHasHoliday = (d: number) => monthHolidays.some((h) => h.day === d);

  const isCurrentMonth = monthOffset === 0;
  const isPast = (d: number) => isCurrentMonth && d < todayDay;

  function dayLabel(day: number): string {
    if (isCurrentMonth && day === todayDay) return "היום";
    const d = new Date(displayYear, displayMonth, day);
    return d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
  }

  return (
    <AppShell title="לוח שנה">
      {/* Month picker popup */}
      {showMonthPicker && (
        <div className="fixed inset-0 z-40 flex items-end" onClick={() => setShowMonthPicker(false)}>
          <div className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px]" />
          <div
            className="relative z-10 w-full rounded-t-3xl bg-background px-5 pt-5 pb-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: `fade-up 200ms ${ease} both` }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            {/* Year navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setMonthOffset((m) => m - 12)}
                className="rounded-xl p-2 active:bg-muted transition-colors"
                aria-label="שנה קודמת"
              >
                <ChevronRight className="size-5 text-muted-foreground" />
              </button>
              <span className="text-lg font-bold">
                {new Date(todayYear, todayMonth + monthOffset, 1).getFullYear()}
              </span>
              <button
                onClick={() => setMonthOffset((m) => m + 12)}
                className="rounded-xl p-2 active:bg-muted transition-colors"
                aria-label="שנה הבאה"
              >
                <ChevronLeft className="size-5 text-muted-foreground" />
              </button>
            </div>
            {/* 4×3 month grid */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {HE_MONTHS.map((name, i) => {
                const offset = (new Date(todayYear, todayMonth + monthOffset, 1).getFullYear() - todayYear) * 12 + i - todayMonth;
                const isActive = offset === monthOffset;
                const isCurrentMonth = offset === 0;
                return (
                  <button
                    key={name}
                    onClick={() => { setMonthOffset(offset); setSelectedDay(null); setShowMonthPicker(false); }}
                    className={cn(
                      "rounded-xl py-2.5 text-xs font-bold transition-[transform,background-color,color] active:scale-[0.90] duration-[140ms]",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : isCurrentMonth
                        ? "bg-primary/12 text-primary"
                        : "bg-muted text-foreground hover:bg-primary/8"
                    )}
                    style={{ transitionTimingFunction: ease }}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => { setMonthOffset(0); setSelectedDay(todayDay); setShowMonthPicker(false); }}
              className="w-full rounded-2xl border border-primary/30 py-2.5 text-sm font-semibold text-primary transition-colors active:bg-primary/8"
            >
              חזרה להיום
            </button>
          </div>
        </div>
      )}

      {/* Month navigation */}
      <div
        className="flex items-center justify-between mb-4"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <button
          onClick={() => { setMonthOffset((m) => m + 1); setSelectedDay(null); }}
          className="rounded-xl p-2 transition-[transform,background-color] duration-[160ms] active:scale-[0.88] active:bg-muted"
          style={{ transitionTimingFunction: ease }}
          aria-label="חודש הבא"
        >
          <ChevronLeft className="size-5 text-muted-foreground" />
        </button>
        <button
          onClick={() => setShowMonthPicker(true)}
          className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold text-foreground transition-[transform,background-color] duration-[160ms] active:scale-[0.95] active:bg-muted"
          style={{ transitionTimingFunction: ease }}
        >
          {monthLabel}
          <ChevronLeft className="size-3.5 text-muted-foreground rotate-90" />
        </button>
        <button
          onClick={() => { setMonthOffset((m) => m - 1); setSelectedDay(null); }}
          className="rounded-xl p-2 transition-[transform,background-color] duration-[160ms] active:scale-[0.88] active:bg-muted"
          style={{ transitionTimingFunction: ease }}
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
      <div className="grid grid-cols-7 gap-y-1 mb-5" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {gridCells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const isToday = isCurrentMonth && day === todayDay;
          const isSelected = day === selectedDay;
          const hasEvent = dayHasEvent(day);
          const hasHoliday = dayHasHoliday(day);
          const past = isPast(day);
          const holidayEmoji = hasHoliday ? monthHolidays.find((h) => h.day === day)?.emoji : null;
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day === selectedDay ? null : day)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1 rounded-xl transition-[transform,background-color,color] duration-[160ms] active:scale-[0.88]",
                isSelected && "bg-primary text-primary-foreground",
                !isSelected && isToday && "bg-primary/12 text-primary",
                past && !isSelected && "opacity-40"
              )}
              style={{ transitionTimingFunction: ease }}
            >
              {hasHoliday && !isSelected && (
                <span className="text-[9px] leading-none">{holidayEmoji}</span>
              )}
              <span className={cn("text-sm font-bold leading-tight", isSelected && "text-primary-foreground", !isSelected && isToday && "text-primary")}>
                {day}
              </span>
              <span className="flex gap-0.5 h-1.5 items-center">
                {hasEvent && (
                  <span className={cn("size-1.5 rounded-full transition-colors duration-200", isSelected ? "bg-primary-foreground/70" : "bg-primary")} />
                )}
                {hasHoliday && (
                  <span className={cn("size-1.5 rounded-full transition-colors duration-200", isSelected ? "bg-primary-foreground/50" : "bg-amber-400")} />
                )}
              </span>
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
          {/* Editing is new and invisible until you tap — say so once, where events are */}
          {monthEvents.length > 0 && (
            <Tip id="edit-event" title="אפשר לערוך כל אירוע" className="mb-4">
              לחיצה על אירוע, או על העיפרון שלידו, פותחת אותו לשינוי שעה, מקום או תאריך.
            </Tip>
          )}

          {/* Selected day events */}
          {selectedDay !== null && (
            <div className="pb-24">
              <div className="flex items-center justify-between mb-3">
                <p className="eyebrow">{dayLabel(selectedDay)}</p>
                <Link
                  to="/event/new"
                  search={{ type: "event", day: selectedDay }}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-[transform] duration-[160ms] active:scale-[0.94]"
                  style={{ transitionTimingFunction: ease }}
                >
                  <CalendarPlus className="size-3.5" />
                  הוסף אירוע
                </Link>
              </div>
              {/* Holidays for selected day */}
              {selectedDayHolidays.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  {selectedDayHolidays.map((h) => (
                    <div
                      key={h.name}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-4 py-3",
                        h.type === "holiday" ? "bg-amber-50 border border-amber-200/60" :
                        h.type === "memorial" ? "bg-slate-50 border border-slate-200/60" :
                        "bg-primary/5 border border-primary/15"
                      )}
                    >
                      <span className="text-xl shrink-0">{h.emoji}</span>
                      <span className={cn(
                        "text-sm font-bold",
                        h.type === "holiday" ? "text-amber-800" :
                        h.type === "memorial" ? "text-slate-700" : "text-primary"
                      )}>{h.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedDayEvents.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-4 text-center text-muted-foreground">
                  <CalendarPlus className="size-8 opacity-30" />
                  <p className="text-sm">אין אירועים ביום זה</p>
                  <Link
                    to="/event/new"
                    search={{ type: "event", day: selectedDay }}
                    className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-[transform] duration-[160ms] active:scale-[0.96]"
                    style={{ transitionTimingFunction: ease }}
                  >
                    <CalendarPlus className="size-4" />
                    הוסף אירוע ליום זה
                  </Link>
                </div>
              ) : (
                <>
                  <ol className="space-y-2 border-r border-border/70 pr-4 stagger-list">
                    {selectedDayEvents.map((e) => {
                      const cat = getCat(e.category);
                      return (
                        <li
                          key={e.id}
                          className="relative surface-card rounded-2xl p-3.5"
                        >
                          <span className={`absolute -right-[1.4rem] top-4 size-2.5 rounded-full ring-4 ring-background ${cat.dot}`} />
                          <EventCard e={e} cat={cat} />
                        </li>
                      );
                    })}
                  </ol>
                  <Link
                    to="/event/new"
                    search={{ type: "event", day: selectedDay }}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 py-2.5 text-sm font-semibold text-primary transition-[transform,background-color] duration-[160ms] active:scale-[0.97] active:bg-primary/8"
                    style={{ transitionTimingFunction: ease }}
                  >
                    <CalendarPlus className="size-4" />
                    הוסף אירוע נוסף
                  </Link>
                </>
              )}
            </div>
          )}

          {/* All upcoming events when no day selected */}
          {selectedDay === null && (
            <div className="pb-24">
              {monthEvents.length === 0 ? (
                <div className="py-10 flex flex-col items-center gap-3 text-center text-muted-foreground">
                  <CalendarPlus className="size-8 opacity-30" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">אין אירועים בחודש זה</p>
                    <p className="mt-0.5 text-xs">פגישות, תורים ושמחות, עם שעה ומקום. ימי הולדת חוזרים לבד כל שנה.</p>
                  </div>
                  <Link
                    to="/event/new"
                    search={{ type: "event" }}
                    className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-[transform] duration-[160ms] active:scale-[0.96]"
                    style={{ transitionTimingFunction: ease }}
                  >
                    <CalendarPlus className="size-4" />
                    הוסף אירוע
                  </Link>
                </div>
              ) : (
                <div className="space-y-5">
                  {[...new Set(monthEvents.map((e) => e.day))]
                    .sort((a, b) => a - b)
                    .map((day) => (
                    <div key={day}>
                      <p className="eyebrow mb-2">{dayLabel(day)}</p>
                      <ol className="space-y-2 border-r border-border/70 pr-4 stagger-list">
                        {monthEvents.filter((e) => occursOn(e, day, displayMonthNum, displayYear)).map((e) => {
                          const cat = getCat(e.category);
                          return (
                            <li
                              key={e.id}
                              className="relative surface-card rounded-2xl p-3.5"
                            >
                              <span className={`absolute -right-[1.4rem] top-4 size-2.5 rounded-full ring-4 ring-background ${cat.dot}`} />
                              <EventCard e={e} cat={cat} />
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

    </AppShell>
  );
}

function EventCard({ e, cat }: { e: CalEvent; cat: ReturnType<typeof getCat> }) {
  const deleteEvent = useDeleteEvent();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    deleteEvent.mutate(e.id);
  }

  return (
    <div className="flex items-start gap-3">
      {/* The whole text opens the edit form, not just the pencil */}
      <Link to="/event/new" search={{ type: "event", edit: e.id }} className="flex-1 min-w-0">
        <p className="text-sm font-bold flex items-center gap-1.5">
          <EventTypeIcon e={e} className="size-3.5 text-primary shrink-0" />
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
      </Link>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${cat.soft}`}>
        {cat.label}
      </span>
      <EditEventButton id={e.id} title={e.title} />
      <button
        onClick={handleDelete}
        disabled={deleteEvent.isPending}
        className={cn(
          "shrink-0 rounded-full p-1.5 transition-[background-color,color,transform] duration-[160ms] active:scale-[0.85]",
          confirmDelete
            ? "bg-red-100 text-red-500"
            : "text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground"
        )}
        style={{ transitionTimingFunction: ease }}
        aria-label="מחק אירוע"
        title={confirmDelete ? "לחץ שוב למחיקה" : "מחק"}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
