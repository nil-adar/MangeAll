import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useEvents, useDeleteEvent, type CalEvent } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { EditEventButton } from "@/components/EditEventButton";

/**
 * The saved-birthdays list. Shared by the /birthdays page and the bottom of the
 * add-birthday form, so both always show the same data the same way.
 */

const ease = "cubic-bezier(0.23, 1, 0.32, 1)";

const HE_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

/** 999 = no month recorded, so the countdown can't be computed. */
const NO_DATE = 999;

function daysUntilBirthday(month: number | null | undefined, day: number): number {
  if (!month) return NO_DATE;
  const now = new Date();
  // Compare against midnight, not the current time: comparing against `now`
  // pushed a birthday TODAY to next year (00:00 < 14:30), so "היום" never showed.
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(startOfToday.getFullYear(), month - 1, day);
  if (next < startOfToday) next = new Date(startOfToday.getFullYear() + 1, month - 1, day);
  const days = Math.round((next.getTime() - startOfToday.getTime()) / 86_400_000);
  return Number.isFinite(days) ? days : NO_DATE;
}

export function countdownLabel(days: number): { text: string; color: string } {
  if (!Number.isFinite(days) || days === NO_DATE)
    return { text: "תאריך חסר", color: "text-muted-foreground" };
  if (days === 0) return { text: "🎉 היום!", color: "text-primary" };
  if (days === 1) return { text: "מחר", color: "text-amber-500" };
  if (days <= 7) return { text: `בעוד ${days} ימים`, color: "text-amber-500" };
  if (days <= 30) return { text: `בעוד ${days} ימים`, color: "text-muted-foreground" };
  return { text: `${days} ימים`, color: "text-muted-foreground" };
}

/** "יום הולדת ל<name>" / "יום הולדת של <name>" → name */
export function extractName(title: string) {
  return title.replace(/^\s*יום הולדת\s*(של\s*|ל)?/, "").trim() || title;
}

export type Birthday = CalEvent & { daysUntil: number };

/**
 * All birthdays, soonest first. is_birthday OR a "יום הולדת…" title: a birthday
 * typed into the regular event form is saved with is_birthday=false.
 */
export function useBirthdays() {
  const { data: events = [], isLoading } = useEvents();
  const birthdays: Birthday[] = events
    .filter((e) => e.is_birthday || /^\s*יום הולדת/.test(e.title))
    .map((e) => ({ ...e, daysUntil: daysUntilBirthday(e.month, e.day) }))
    .sort((a, b) => a.daysUntil - b.daysUntil);
  return { birthdays, isLoading };
}

export function BirthdayList({ birthdays }: { birthdays: Birthday[] }) {
  const deleteEvent = useDeleteEvent();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function handleDelete(id: string) {
    if (confirmId === id) {
      deleteEvent.mutate(id);
      setConfirmId(null);
    } else {
      setConfirmId(id);
      setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 3000);
    }
  }

  // Exhaustive by construction: `rest` is the negation of `upcoming`, so a row
  // with an unexpected daysUntil still lands somewhere instead of vanishing.
  const upcoming = birthdays.filter((b) => b.daysUntil <= 30);
  const rest = birthdays.filter((b) => !(b.daysUntil <= 30));

  // A render function, not a nested component: a nested component is a new type
  // every render, which would remount rows (and replay their animation) on each tap.
  function renderRow(b: Birthday, i: number, soon: boolean) {
    const name = extractName(b.title);
    const { text, color } = countdownLabel(b.daysUntil);
    const monthLabel = b.month ? HE_MONTHS[b.month - 1] : "";
    const isConfirm = confirmId === b.id;
    return (
      <div
        key={b.id}
        className="flex items-center gap-3 px-4 py-3.5"
        style={{ animation: `fade-up 260ms ${ease} ${i * 35}ms both` }}
      >
        {soon && b.daysUntil === 0 ? (
          <span className="text-2xl shrink-0">🎉</span>
        ) : soon && b.daysUntil <= 7 ? (
          <span className="text-2xl shrink-0">🎂</span>
        ) : (
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full font-bold text-sm",
              soon ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            {name.charAt(0)}
          </span>
        )}
        <Link to="/event/new" search={{ type: "event", edit: b.id }} className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{name}</p>
          {monthLabel && (
            <p className="text-xs text-muted-foreground">{b.day} ב{monthLabel}</p>
          )}
        </Link>
        <span className={cn("text-xs shrink-0 mr-1", soon ? `font-bold ${color}` : "text-muted-foreground")}>
          {text}
        </span>
        <EditEventButton id={b.id} title={b.title} />
        <button
          type="button"
          onClick={() => handleDelete(b.id)}
          className={cn(
            "shrink-0 rounded-full p-1.5 transition-[color,background-color] duration-[160ms]",
            isConfirm ? "bg-red-500 text-white" : "text-muted-foreground/40 hover:text-red-400"
          )}
          style={{ transitionTimingFunction: ease }}
          aria-label={isConfirm ? "לחץ שוב כדי למחוק" : "מחק"}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {upcoming.length > 0 && (
        <section style={{ animation: `fade-up 260ms ${ease} 0ms both` }}>
          <p className="eyebrow mb-3">קרובים</p>
          <div className="surface-card rounded-2xl divide-y divide-border/50">
            {upcoming.map((b, i) => renderRow(b, i, true))}
          </div>
        </section>
      )}
      {rest.length > 0 && (
        <section style={{ animation: `fade-up 260ms ${ease} 60ms both` }}>
          <p className="eyebrow mb-3">בהמשך השנה</p>
          <div className="surface-card rounded-2xl divide-y divide-border/50">
            {rest.map((b, i) => renderRow(b, i, false))}
          </div>
        </section>
      )}
    </div>
  );
}
