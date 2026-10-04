import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  cityLabel,
  getHolidaysForDay,
  hebrewDateLabel,
  nextHoliday,
  NO_CITY,
  shabbatTimes,
  useShabbatCity,
} from "@/lib/jewish-calendar";
import { CITIES, setShabbatCity } from "@/lib/shabbat-city";

const EASE = "var(--ease-out)";

/** "היום" / "מחר" / "ביום שישי" */
function whenLabel(date: Date, now: Date): string {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((date.getTime() - start.getTime()) / 86_400_000);
  if (days === 0) return "היום";
  if (days === 1) return "מחר";
  return `ב${date.toLocaleDateString("he-IL", { weekday: "long" })}`;
}

/**
 * Today in the Hebrew calendar, on the home page — only for someone who asked
 * for it. Until they answer, a one-time question; "לא תודה" hides it for
 * good (the profile can bring it back).
 */
export function JewishDayCard() {
  const city = useShabbatCity();
  if (city === null) return <ShabbatQuestion />;
  if (city === NO_CITY) return null;
  return <ShabbatCard city={city} />;
}

/** Asked once: show Shabbat and holiday times here, and for which city? */
function ShabbatQuestion() {
  const [picking, setPicking] = useState(false);

  return (
    <section
      className="surface-card rounded-3xl p-4"
      style={{ animation: `fade-up 280ms ${EASE} both` }}
      aria-label="זמני שבת וחגים"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/12 text-lg" aria-hidden>
          🕯️
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">להציג כאן זמני שבת וחגים?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            הדלקת נרות, יציאה, התאריך העברי והחג הקרוב. אפשר לשנות בכל רגע בפרופיל.
          </p>
        </div>
      </div>

      {picking ? (
        <select
          // Picking a city is the answer: the card appears right away
          defaultValue=""
          onChange={(e) => e.target.value && setShabbatCity(e.target.value)}
          autoFocus
          className="mt-3 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/40"
          aria-label="עיר לזמני שבת"
        >
          <option value="" disabled>באיזו עיר?</option>
          {CITIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="flex-1 rounded-2xl bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-transform duration-150 active:scale-[0.97]"
            style={{ transitionTimingFunction: EASE }}
          >
            כן, להציג
          </button>
          <button
            type="button"
            onClick={() => setShabbatCity(NO_CITY)}
            className="rounded-2xl bg-muted px-5 py-2.5 text-sm font-bold text-muted-foreground transition-transform duration-150 active:scale-[0.97]"
            style={{ transitionTimingFunction: EASE }}
          >
            לא תודה
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * The Hebrew date, today's holiday, the coming Shabbat (or holiday) with
 * candle-lighting and end times for the city, and the next holiday.
 */
function ShabbatCard({ city }: { city: string }) {
  const now = new Date();
  // Cheap to compute (holidays are cached per year), so no memo
  const hebrew = hebrewDateLabel(now, true);
  const today = getHolidaysForDay(now.getFullYear(), now.getMonth() + 1, now.getDate())[0] ?? null;
  const times = shabbatTimes(city, now);
  const next = nextHoliday(30);

  return (
    <section
      className="surface-card rounded-3xl p-4"
      style={{ animation: `fade-up 280ms ${EASE} both` }}
      aria-label="הלוח העברי"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">{hebrew}</p>
        {today && (
          <span className="truncate rounded-full bg-amber-500/12 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
            {today.emoji} {today.name}
          </span>
        )}
      </div>

      {times && (
        <div className="mt-3 flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/12 text-lg" aria-hidden>
            🕯️
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{times.title}</p>
            <p className="text-xs text-muted-foreground">
              {times.ongoing ? (
                <>
                  יציאה {times.havdalah && whenLabel(times.havdalah.date, now)}{" "}
                  <span className="font-bold tabular-nums text-foreground">{times.havdalah?.time}</span>
                </>
              ) : (
                <>
                  הדלקת נרות {whenLabel(times.candles.date, now)}{" "}
                  <span className="font-bold tabular-nums text-foreground">{times.candles.time}</span>
                  {times.havdalah && (
                    <>
                      {" · "}יציאה{" "}
                      <span className="font-bold tabular-nums text-foreground">{times.havdalah.time}</span>
                    </>
                  )}
                </>
              )}
            </p>
          </div>
          <Link
            to="/profile"
            hash="hebrew-calendar"
            className="shrink-0 rounded-lg px-1.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors duration-150 hover-fine:hover:text-primary"
            style={{ transitionTimingFunction: EASE }}
          >
            {cityLabel(city)}
          </Link>
        </div>
      )}

      {next && (
        <p className="mt-3 text-xs text-muted-foreground">
          {next.emoji} {next.name.split(" · ")[0]}{" "}
          <span className="font-semibold">{next.daysUntil === 1 ? "מחר" : `בעוד ${next.daysUntil} ימים`}</span>
        </p>
      )}
    </section>
  );
}
