import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cake, ChevronDown, Trash2 } from "lucide-react";
import { useEvents, useDeleteEvent, type CalEvent } from "@/lib/queries";
import { shekel } from "@/lib/config";
import { cn } from "@/lib/utils";
import { EditEventButton } from "@/components/EditEventButton";
import { countdownLabel } from "@/components/BirthdayList";
import {
  NO_DATE,
  OCCASIONS,
  occasionDateLabel,
  occasionOf,
  pastLabel,
  toOccasion,
  type Occasion,
} from "@/lib/occasions";

/**
 * The saved life-events list ("שמחות") — the occasions counterpart of
 * BirthdayList. Used by the /occasions page.
 */

const ease = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * All occasions, soonest first. A row counts if `occasion` is set OR its title
 * reads like one ("החתונה של…", "בר מצווה…") — an occasion typed into the
 * regular event form, or saved before the column existed, has occasion=null.
 * Past one-time occasions sort last, most recent first.
 */
export function useOccasions() {
  const { data: events = [], isLoading } = useEvents();
  const all: Occasion[] = events
    // A "יום הולדת…" title belongs to useBirthdays, whatever else it says
    .filter((e) => !/^\s*יום הולדת/.test(e.title))
    .flatMap((e) => {
      const type = occasionOf(e);
      return type ? [toOccasion(e, type)] : [];
    });
  const upcoming = all.filter((o) => o.daysUntil >= 0).sort((a, b) => a.daysUntil - b.daysUntil);
  const past = all.filter((o) => o.daysUntil < 0).sort((a, b) => b.daysUntil - a.daysUntil);
  return { occasions: [...upcoming, ...past], upcoming, past, isLoading };
}

/**
 * The little icon before an event's title in the calendar / home lists:
 * a cake for birthdays, the occasion's own icon for life events, else nothing.
 */
export function EventTypeIcon({ e, className }: { e: CalEvent; className?: string }) {
  if (e.is_birthday) return <Cake className={className} aria-label="יום הולדת" />;
  const type = occasionOf(e);
  if (!type) return null;
  const Icon = OCCASIONS[type].icon;
  return <Icon className={className} aria-label={OCCASIONS[type].label} />;
}

export function OccasionList({ upcoming, past }: { upcoming: Occasion[]; past: Occasion[] }) {
  const deleteEvent = useDeleteEvent();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);

  function handleDelete(id: string) {
    if (confirmId === id) {
      deleteEvent.mutate(id);
      setConfirmId(null);
    } else {
      setConfirmId(id);
      setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 3000);
    }
  }

  // Exhaustive by construction, as in BirthdayList: `later` is the negation of `soon`.
  const soon = upcoming.filter((o) => o.daysUntil <= 30);
  const later = upcoming.filter((o) => !(o.daysUntil <= 30));

  // A render function, not a nested component — see BirthdayList.
  function renderRow(o: Occasion, i: number, kind: "soon" | "later" | "past") {
    const meta = OCCASIONS[o.type];
    const isConfirm = confirmId === o.id;
    const isSoon = kind === "soon";
    const { text, color } =
      kind === "past" ? { text: pastLabel(o.daysUntil), color: "" } : countdownLabel(o.daysUntil);
    const details = [
      o.daysUntil === NO_DATE ? "" : occasionDateLabel(o),
      o.time && o.time !== "כל היום" ? o.time : "",
      o.location ?? "",
    ].filter(Boolean);
    return (
      <div
        key={o.id}
        className={cn("flex items-center gap-3 px-4 py-3.5", kind === "past" && "opacity-70")}
        style={{ animation: `fade-up 260ms ${ease} ${i * 35}ms both` }}
      >
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full text-xl",
            isSoon ? "bg-primary/10" : "bg-muted"
          )}
          aria-label={meta.label}
        >
          {meta.emoji}
        </span>
        <Link to="/event/new" search={{ type: "event", edit: o.id }} className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{o.title}</p>
          {details.length > 0 && (
            <p className="text-xs text-muted-foreground truncate">{details.join(" · ")}</p>
          )}
          {(o.yearNumber != null || o.gift != null) && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {o.yearNumber != null && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  שנה {o.yearNumber}
                </span>
              )}
              {o.gift != null && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  🎁 {shekel(o.gift)}
                </span>
              )}
            </div>
          )}
        </Link>
        <span className={cn("text-xs shrink-0 mr-1", isSoon ? `font-bold ${color}` : "text-muted-foreground")}>
          {text}
        </span>
        <EditEventButton id={o.id} title={o.title} />
        <button
          type="button"
          onClick={() => handleDelete(o.id)}
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
      {soon.length > 0 && (
        <section style={{ animation: `fade-up 260ms ${ease} 0ms both` }}>
          <p className="eyebrow mb-3">קרובים</p>
          <div className="surface-card rounded-2xl divide-y divide-border/50">
            {soon.map((o, i) => renderRow(o, i, "soon"))}
          </div>
        </section>
      )}
      {later.length > 0 && (
        <section style={{ animation: `fade-up 260ms ${ease} 60ms both` }}>
          <p className="eyebrow mb-3">בהמשך</p>
          <div className="surface-card rounded-2xl divide-y divide-border/50">
            {later.map((o, i) => renderRow(o, i, "later"))}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section style={{ animation: `fade-up 260ms ${ease} 120ms both` }}>
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            aria-expanded={showPast}
            className="eyebrow mb-3 flex items-center gap-1.5"
          >
            עברו ({past.length})
            <ChevronDown
              className={cn("size-3.5 transition-transform duration-200", showPast && "rotate-180")}
              style={{ transitionTimingFunction: ease }}
            />
          </button>
          {showPast && (
            <div className="surface-card rounded-2xl divide-y divide-border/50">
              {past.map((o, i) => renderRow(o, i, "past"))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
