// The Hebrew calendar: Hebrew dates, Israeli holidays for any year, and
// Shabbat / holiday candle-lighting times for a chosen city. Everything is
// computed on the device by @hebcal/core — no network, no stored data.
import {
  HebrewCalendar,
  Location,
  ParshaEvent,
  flags,
  type Event as HebcalEvent,
  type TimedEvent,
} from "@hebcal/core";
import { CITIES } from "./shabbat-city";

const HE = "he-x-NoNikud";

// Hebrew date labels live in hebrew-date.ts (shared with the events code);
// re-exported so the calendar screens import from one place
export { hebrewDayOfMonth, hebrewDateLabel, hebrewMonthsOf } from "./hebrew-date";
export { cityLabel, NO_CITY, useShabbatCity } from "./shabbat-city";

// ── Holidays ─────────────────────────────────────────────────────────────────

// type: "holiday" = a festive day | "memorial" = a fast or remembrance day |
// "eve" = erev chag
export type Holiday = {
  year: number;
  month: number; // 1-based
  day: number;
  name: string;
  emoji: string;
  type: "holiday" | "memorial" | "eve";
};

const SHOWN =
  flags.CHAG | flags.EREV | flags.CHOL_HAMOED | flags.MAJOR_FAST |
  flags.MINOR_FAST | flags.MINOR_HOLIDAY | flags.MODERN_HOLIDAY;

// Real days, but too minor (or too niche) for a household calendar
const HIDDEN = new Set([
  "Leil Selichot", "Purim Katan", "Shushan Purim Katan", "Rosh Hashana LaBehemot",
  "Chag HaBanot", "Pesach Sheni", "Ta'anit Bechorot", "Yom HaAliyah",
  "Yom HaAliyah School Observance", "Ben-Gurion Day", "Herzl Day", "Jabotinsky Day",
  "Family Day", "Hebrew Language Day", "Sigd", "Yitzhak Rabin Memorial Day",
]);

const MEMORIAL = new Set(["Yom HaShoah", "Yom HaZikaron", "Tish'a B'Av", "Erev Tish'a B'Av"]);

// First match wins: more specific names before the ones they contain
const EMOJI: Array<[string, string]> = [
  ["Yom Kippur", "🕯️"], ["Rosh Hashana", "🍎"], ["Hoshana Raba", "🌿"], ["Sukkot", "🌿"],
  ["Shmini Atzeret", "📜"], ["Chanukah", "🕎"], ["Tu BiShvat", "🌳"], ["Purim", "🎭"],
  ["Pesach", "🍷"], ["Yom HaShoah", "🕯️"], ["Yom HaZikaron", "🕯️"], ["Yom HaAtzma'ut", "🇮🇱"],
  ["Lag BaOmer", "🔥"], ["Yom Yerushalayim", "🕍"], ["Shavuot", "🌾"], ["Tu B'Av", "❤️"],
  ["Tish'a B'Av", "🕯️"],
];

/** hebcal's Hebrew names, tidied for a phone screen. */
function holidayName(ev: HebcalEvent): string {
  const desc = ev.getDesc();
  if (desc === "Shmini Atzeret") return "שמיני עצרת · שמחת תורה"; // one day in Israel
  if (desc.includes("Hoshana Raba")) return "הושענא רבה";
  const name = ev.render(HE).replace(/\s+\d{4}$/, "");
  const cholHamoed = name.match(/^(סוכות|פסח) .+\(חוה״מ\)$/);
  if (cholHamoed) return `חול המועד ${cholHamoed[1]}`;
  // "חנוכה: ג׳ נרות" → "חנוכה · נר ג׳"; "חנוכה: יום ח׳" → "חנוכה · יום ח׳"
  const chanukah = name.match(/^חנוכה: (\S+) נרו?ת?$/);
  if (chanukah) return `חנוכה · נר ${chanukah[1]}`;
  return name.replace(/^חנוכה: /, "חנוכה · ");
}

function toHoliday(ev: HebcalEvent): Holiday {
  const d = ev.getDate().greg();
  const desc = ev.getDesc();
  const f = ev.getFlags();
  const type: Holiday["type"] =
    // The first candle is lit on an evening, but it's Chanukah, not its eve
    f & flags.EREV && !desc.startsWith("Chanukah") ? "eve"
    : f & flags.CHAG ? "holiday"
    : MEMORIAL.has(desc) || f & (flags.MAJOR_FAST | flags.MINOR_FAST) ? "memorial"
    : "holiday";
  const emoji = EMOJI.find(([key]) => desc.includes(key))?.[1] ?? (type === "memorial" ? "🕯️" : "✡️");
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), name: holidayName(ev), emoji, type };
}

const holidayCache = new Map<number, Holiday[]>();

/** Every holiday in a Gregorian year (Israel schedule). Cached per year. */
function holidaysOfYear(year: number): Holiday[] {
  let list = holidayCache.get(year);
  if (!list) {
    list = HebrewCalendar.calendar({ year, il: true, noRoshChodesh: true, noSpecialShabbat: true })
      .filter((ev) => ev.getFlags() & SHOWN && !HIDDEN.has(ev.getDesc()))
      .map(toHoliday);
    holidayCache.set(year, list);
  }
  return list;
}

export function getHolidaysForMonth(year: number, month: number): Holiday[] {
  return holidaysOfYear(year).filter((h) => h.month === month);
}

export function getHolidaysForDay(year: number, month: number, day: number): Holiday[] {
  return holidaysOfYear(year).filter((h) => h.month === month && h.day === day);
}

/**
 * The next holiday to start after today (not eves or fasts), within `days`.
 * A day that only continues the one before it — Rosh Hashana II, chol
 * hamoed, the third candle — doesn't count as a new holiday.
 */
export function nextHoliday(days = 30): (Holiday & { daysUntil: number }) | null {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const all = [...holidaysOfYear(start.getFullYear()), ...holidaysOfYear(start.getFullYear() + 1)];
  for (const h of all) {
    if (h.type !== "holiday") continue;
    const date = new Date(h.year, h.month - 1, h.day);
    const daysUntil = Math.round((date.getTime() - start.getTime()) / 86_400_000);
    if (daysUntil <= 0) continue;
    if (daysUntil > days) return null;
    const dayBefore = new Date(h.year, h.month - 1, h.day - 1);
    const continues = all.some(
      (p) => p.type === "holiday" && p.emoji === h.emoji &&
        p.year === dayBefore.getFullYear() && p.month === dayBefore.getMonth() + 1 && p.day === dayBefore.getDate()
    );
    if (!continues) return { ...h, daysUntil };
  }
  return null;
}

// ── Locations ────────────────────────────────────────────────────────────────

const locationCache = new Map<string, Location>();

function locationOf(id: string | null): Location | null {
  const city = CITIES.find((c) => c.id === id);
  if (!city) return null;
  let loc = locationCache.get(city.id);
  if (!loc) {
    loc = city.lat != null && city.lng != null
      ? new Location(city.lat, city.lng, true, "Asia/Jerusalem", city.en, "IL")
      : Location.lookup(city.en);
    if (!loc) return null;
    locationCache.set(city.id, loc);
  }
  return loc;
}

// ── Shabbat and holiday times ────────────────────────────────────────────────

export type Zman = { date: Date; time: string };

export type ShabbatTimes = {
  /** "שבת פרשת בראשית", "ערב סוכות" */
  title: string;
  candles: Zman;
  havdalah: Zman | null;
  /** Candles are already lit: it's Shabbat (or the holiday) right now. */
  ongoing: boolean;
};

const isHavdalah = (ev: HebcalEvent) => ev.getDesc() === "Havdalah";
// Havdalah carries the after-nightfall flag too, so it's ruled out by name
const isCandles = (ev: HebcalEvent) =>
  "eventTime" in ev && !isHavdalah(ev) &&
  (ev.getFlags() & (flags.LIGHT_CANDLES | flags.LIGHT_CANDLES_TZEIS)) !== 0;

function timedEvents(location: Location, start: Date, end: Date): HebcalEvent[] {
  return HebrewCalendar.calendar({ start, end, location, candlelighting: true, il: true, sedrot: true });
}

/**
 * The coming (or current) Shabbat or holiday: when candles are lit, when it
 * ends, and what it is. Null when no city is set.
 */
export function shabbatTimes(cityId: string | null, now = new Date()): ShabbatTimes | null {
  const location = locationOf(cityId);
  if (!location) return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 9);
  const events = timedEvents(location, start, end);

  const endEv = events.find((ev) => isHavdalah(ev) && (ev as TimedEvent).eventTime > now) as TimedEvent | undefined;
  if (!endEv) return null;
  // The first candles after the previous havdalah: the start of this block
  // (a holiday next to Shabbat lights twice but ends once)
  const endIdx = events.indexOf(endEv);
  let prevEnd = -1;
  for (let i = endIdx - 1; i >= 0; i--) if (isHavdalah(events[i]!)) { prevEnd = i; break; }
  const candlesEv = events.slice(prevEnd + 1, endIdx).find(isCandles) as TimedEvent | undefined;
  if (!candlesEv) return null;

  const candleDay = candlesEv.getDate().greg();
  const friday = candleDay.getDay() === 5;
  const linked = (candlesEv as TimedEvent & { linkedEvent?: HebcalEvent }).linkedEvent;
  let title: string;
  if (linked) {
    // Candles are lit on the eve; the card is about the day itself
    title = holidayName(linked).replace(/^ערב /, "") + (friday ? " ושבת" : "");
  } else {
    const parsha = events.find(
      (ev) => ev instanceof ParshaEvent && ev.getDate().greg().getTime() > candleDay.getTime()
    );
    title = parsha ? `שבת ${parsha.render(HE)}` : "שבת";
  }

  return {
    title,
    candles: { date: candleDay, time: candlesEv.eventTimeStr },
    havdalah: { date: endEv.getDate().greg(), time: endEv.eventTimeStr },
    ongoing: candlesEv.eventTime <= now,
  };
}

/** Candle lighting / havdalah that fall on one date, for the calendar's day view. */
export function zmanimOn(cityId: string | null, date: Date): { candles?: string; havdalah?: string; parsha?: string } {
  const location = locationOf(cityId);
  if (!location) return {};
  const events = timedEvents(location, date, date);
  const out: { candles?: string; havdalah?: string; parsha?: string } = {};
  for (const ev of events) {
    if (isCandles(ev) && !out.candles) out.candles = (ev as TimedEvent).eventTimeStr;
    else if (isHavdalah(ev)) out.havdalah = (ev as TimedEvent).eventTimeStr;
    else if (ev instanceof ParshaEvent) out.parsha = ev.render(HE);
  }
  return out;
}
