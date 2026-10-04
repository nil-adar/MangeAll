// Hebrew dates and events that repeat by them (a Hebrew birthday, a yahrzeit).
// Uses only @hebcal/hdate — small enough for the shared queries chunk; the
// holidays and Shabbat times live in jewish-calendar.ts, which needs all of
// @hebcal/core.
import {
  HDate,
  Locale,
  daysInMonth,
  gematriya,
  getBirthdayOrAnniversary,
  getYahrzeit,
  isLeapYear,
} from "@hebcal/hdate";

const HE = "he-x-NoNikud";

/** "תשרי", "אדר א׳" (in a leap year), "אדר" (in a common one). */
function monthName(hd: HDate): string {
  return Locale.gettext(hd.getMonthName(), HE);
}

/** "כ״ג" — the day of the Hebrew month, as Hebrew numerals. */
export function hebrewDayOfMonth(date: Date): string {
  return gematriya(new HDate(date).getDate());
}

/** "כ״ג בתשרי", or "כ״ג בתשרי תשפ״ז" with the year. */
export function hebrewDateLabel(date: Date, withYear = false): string {
  const hd = new HDate(date);
  const label = `${gematriya(hd.getDate())} ב${monthName(hd)}`;
  return withYear ? `${label} ${gematriya(hd.getFullYear())}` : label;
}

/**
 * The Hebrew months a Gregorian month spans, for the calendar header:
 * "תשרי–חשון תשפ״ז", or "אלול תשפ״ו–תשרי תשפ״ז" across a new year.
 */
export function hebrewMonthsOf(year: number, month: number): string {
  const first = new HDate(new Date(year, month - 1, 1));
  const last = new HDate(new Date(year, month, 0));
  const a = monthName(first);
  const b = monthName(last);
  const ya = gematriya(first.getFullYear());
  const yb = gematriya(last.getFullYear());
  if (a === b) return `${a} ${ya}`;
  return ya === yb ? `${a}–${b} ${ya}` : `${a} ${ya}–${b} ${yb}`;
}

// ── Events that repeat by the Hebrew date ────────────────────────────────────
// An event row carries hebrew_day / hebrew_month / hebrew_year (see
// hebrew-dates-migration.sql). Its day/month columns still hold a Gregorian
// date — the occurrence it was saved for — so lists sort and older app
// versions show something sensible; the real dates come from here.

export type HebrewDated = {
  title: string;
  hebrew_day?: number | null;
  hebrew_month?: number | null;
  hebrew_year?: number | null;
};

export function hasHebrewDate<T extends HebrewDated>(
  e: T,
): e is T & { hebrew_day: number; hebrew_month: number; hebrew_year: number } {
  return e.hebrew_day != null && e.hebrew_month != null && e.hebrew_year != null;
}

// A yahrzeit moves by different rules than a birthday when the date doesn't
// exist every year (Adar in a leap year, 30 Cheshvan / 30 Kislev)
const MEMORIAL_TITLE = /אזכרה|יארצייט|יום השנה ל|יום פטירה|יום הפטירה/;

const occurrenceCache = new Map<string, Date[]>();

/**
 * When a Hebrew-dated event falls in a Gregorian year: usually once, rarely
 * twice (a date in early Tevet can land in both January and December), and
 * never before the date it was saved from.
 */
export function hebrewOccurrencesIn(e: HebrewDated, gYear: number): Date[] {
  if (!hasHebrewDate(e)) return [];
  const memorial = MEMORIAL_TITLE.test(e.title);
  const key = `${e.hebrew_day}/${e.hebrew_month}/${e.hebrew_year}/${memorial ? "y" : "b"}/${gYear}`;
  let list = occurrenceCache.get(key);
  if (!list) {
    const orig = new HDate(e.hebrew_day, e.hebrew_month, e.hebrew_year);
    const firstHebrewYear = new HDate(new Date(gYear, 0, 1)).getFullYear();
    list = [];
    for (const hy of [firstHebrewYear, firstHebrewYear + 1]) {
      let date: Date | undefined;
      if (hy === orig.getFullYear()) date = orig.greg();
      else if (hy > orig.getFullYear()) date = memorial ? getYahrzeit(hy, orig) : getBirthdayOrAnniversary(hy, orig);
      if (date && date.getFullYear() === gYear) list.push(date);
    }
    occurrenceCache.set(key, list);
  }
  return list;
}

/** The next time it comes round, today included. Null if it never will. */
export function nextHebrewOccurrence(e: HebrewDated, from = new Date()): Date | null {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (const y of [start.getFullYear(), start.getFullYear() + 1]) {
    const hit = hebrewOccurrencesIn(e, y).find((d) => d >= start);
    if (hit) return hit;
  }
  return null;
}

/** "ט״ו באב" — the stored Hebrew date, without a year. */
export function hebrewFieldsLabel(e: HebrewDated): string {
  if (!hasHebrewDate(e)) return "";
  const hd = new HDate(e.hebrew_day, e.hebrew_month, e.hebrew_year);
  return `${gematriya(hd.getDate())} ב${monthName(hd)}`;
}

/** The fields to save for an event that repeats on the Hebrew date of `date`. */
export function hebrewFieldsOf(date: Date) {
  const hd = new HDate(date);
  return { hebrew_day: hd.getDate(), hebrew_month: hd.getMonth(), hebrew_year: hd.getFullYear() };
}

// ── Picking a Hebrew birthday without a year ─────────────────────────────────
// Without a birth year, a reference year stands in. It decides two things:
// whether "Adar" means the Adar of a common year or Adar I / II of a leap year
// (they move differently in leap years), and that 30 Cheshvan / 30 Kislev
// exist. Both reference years have 30 days in Cheshvan and in Kislev.
const REF_COMMON = 5785;
const REF_LEAP = 5779;

export type HebrewMonthChoice = { id: string; label: string; month: number; year: number };

export const HEBREW_MONTH_CHOICES: HebrewMonthChoice[] = [
  { id: "tishrei", label: "תשרי", month: 7, year: REF_COMMON },
  { id: "cheshvan", label: "חשון", month: 8, year: REF_COMMON },
  { id: "kislev", label: "כסלו", month: 9, year: REF_COMMON },
  { id: "tevet", label: "טבת", month: 10, year: REF_COMMON },
  { id: "shvat", label: "שבט", month: 11, year: REF_COMMON },
  { id: "adar", label: "אדר", month: 12, year: REF_COMMON },
  { id: "adar1", label: "אדר א׳", month: 12, year: REF_LEAP },
  { id: "adar2", label: "אדר ב׳", month: 13, year: REF_LEAP },
  { id: "nisan", label: "ניסן", month: 1, year: REF_COMMON },
  { id: "iyyar", label: "אייר", month: 2, year: REF_COMMON },
  { id: "sivan", label: "סיון", month: 3, year: REF_COMMON },
  { id: "tamuz", label: "תמוז", month: 4, year: REF_COMMON },
  { id: "av", label: "אב", month: 5, year: REF_COMMON },
  { id: "elul", label: "אלול", month: 6, year: REF_COMMON },
];

/** The picker entry for stored fields (Adar in a leap year is Adar I). */
export function monthChoiceOf(month: number, year: number): HebrewMonthChoice {
  const id =
    month === 12 ? (isLeapYear(year) ? "adar1" : "adar")
    : month === 13 ? "adar2"
    : HEBREW_MONTH_CHOICES.find((c) => c.month === month)?.id;
  return HEBREW_MONTH_CHOICES.find((c) => c.id === id) ?? HEBREW_MONTH_CHOICES[0]!;
}

export function daysInChoice(choice: HebrewMonthChoice): number {
  return daysInMonth(choice.month, choice.year);
}

/** The picker entry for this Hebrew month, as a starting point. */
export function currentMonthChoice(): HebrewMonthChoice {
  const hd = new HDate();
  return monthChoiceOf(hd.getMonth(), hd.getFullYear());
}

/** "ט״ו" etc. for the day grid. */
export function hebrewNumeral(n: number): string {
  return gematriya(n);
}
