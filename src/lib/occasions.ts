// Life events ("שמחות") — weddings, engagements, bar/bat mitzvahs, brit,
// anniversaries. Stored as rows in `events` with `occasion` + `year` set
// (see occasions-migration.sql). Shared by the /occasions page, the quick
// form in event.new.tsx, the home-page card and the calendar icons.
import { Baby, BookOpen, Gem, Heart, Wine, type LucideIcon } from "lucide-react";
import { isOneTime, type CalEvent } from "./queries";

export type OccasionType =
  | "wedding"
  | "engagement"
  | "bar_mitzvah"
  | "bat_mitzvah"
  | "brit"
  | "anniversary";

/** Keep in sync with the CHECK constraint in occasions-migration.sql. */
export const OCCASION_ORDER: OccasionType[] = [
  "wedding",
  "engagement",
  "bar_mitzvah",
  "bat_mitzvah",
  "brit",
  "anniversary",
];

export const OCCASIONS: Record<
  OccasionType,
  {
    label: string;
    emoji: string;
    icon: LucideIcon;
    /** Title prefix: "<prefix> <names>" → "החתונה של דנה ויוסי" */
    prefix: string;
    /** Couples get two name fields joined with ו ("דנה ויוסי") */
    couple: boolean;
    placeholder: string;
  }
> = {
  wedding:     { label: "חתונה",     emoji: "💒", icon: Heart,    prefix: "החתונה של",      couple: true,  placeholder: "דנה" },
  engagement:  { label: "אירוסין",   emoji: "💍", icon: Gem,      prefix: "האירוסין של",    couple: true,  placeholder: "דנה" },
  bar_mitzvah: { label: "בר מצווה",  emoji: "📜", icon: BookOpen, prefix: "בר המצווה של",   couple: false, placeholder: "איתי" },
  bat_mitzvah: { label: "בת מצווה",  emoji: "🎀", icon: BookOpen, prefix: "בת המצווה של",   couple: false, placeholder: "נועה" },
  brit:        { label: "ברית",      emoji: "👶", icon: Baby,     prefix: "הברית של",       couple: false, placeholder: "הבן של מיכל ורון" },
  anniversary: { label: "יום נישואין", emoji: "🥂", icon: Wine,   prefix: "יום הנישואין של", couple: true,  placeholder: "אמא" },
};

export function isOccasionType(v: unknown): v is OccasionType {
  return typeof v === "string" && (OCCASION_ORDER as string[]).includes(v);
}

/** "דנה" + "יוסי" → "דנה ויוסי"; the second name is optional. */
export function joinNames(first: string, second: string): string {
  const a = first.trim();
  const b = second.trim();
  return a && b ? `${a} ו${b}` : a || b;
}

export function occasionTitle(type: OccasionType, names: string): string {
  return `${OCCASIONS[type].prefix} ${names}`.trim();
}

/**
 * The reverse of occasionTitle + joinNames, for the edit form:
 * "החתונה של דנה ויוסי" → ["דנה", "יוסי"]. A title that doesn't start with the
 * type's prefix (typed by hand) comes back whole in the first field.
 */
export function splitOccasionTitle(type: OccasionType, title: string): [string, string] {
  const { prefix, couple } = OCCASIONS[type];
  const t = title.trim();
  if (!t.startsWith(prefix)) return [t, ""];
  const names = t.slice(prefix.length).trim();
  if (!couple) return [names, ""];
  const at = names.indexOf(" ו");
  return at === -1 ? [names, ""] : [names.slice(0, at), names.slice(at + 2)];
}

/**
 * Guess the occasion type from a title, for events typed into the regular
 * form (or saved before the occasion column existed) — the same way
 * useBirthdays picks up a "יום הולדת…" title. Order matters: "יום נישואין"
 * is checked before the wedding words.
 */
const KEYWORDS: Array<[OccasionType, RegExp]> = [
  ["anniversary", /יום\s*ה?נישואי[ןם]/],
  ["engagement",  /אירוסי[ןם]/],
  ["wedding",     /חתונ[הת]/],
  // Start of word, allowing one prefix letter ("לבר מצווה", "הברית") but not
  // a longer word ending the same way ("חבר מצווה", "שבת מצווה", "בריתות").
  ["bar_mitzvah", /(^|[^א-ת]|(^|[^א-ת])[ולהב])בר[\s-]*ה?מצו?וה/],
  ["bat_mitzvah", /(^|[^א-ת]|(^|[^א-ת])[ולהב])בת[\s-]*ה?מצו?וה/],
  ["brit",        /(^|[^א-ת]|(^|[^א-ת])[ולהב])ברית(?![א-ת])(?!\s*ה?מועצות)/],
];

export function detectOccasion(title: string): OccasionType | null {
  for (const [type, re] of KEYWORDS) if (re.test(title)) return type;
  return null;
}

/** The stored type if it's valid, else whatever the title suggests. */
export function occasionOf(e: CalEvent): OccasionType | null {
  if (e.is_birthday) return null;
  return isOccasionType(e.occasion) ? e.occasion : detectOccasion(e.title);
}

// ── Dates ────────────────────────────────────────────────────────────────────

/** 999 = no month recorded, so the countdown can't be computed (as in BirthdayList). */
export const NO_DATE = 999;

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export type Occasion = CalEvent & {
  type: OccasionType;
  /** Days to the (next) date. Negative = a one-time occasion that's over. */
  daysUntil: number;
  /** The date it (next) happens — null when the month is missing. */
  date: Date | null;
  /** Anniversaries: which one is coming up ("שנה 5"); null otherwise. */
  yearNumber: number | null;
};

export function toOccasion(e: CalEvent, type: OccasionType): Occasion {
  const today = startOfToday();
  if (!e.month) return { ...e, type, daysUntil: NO_DATE, date: null, yearNumber: null };

  let date: Date;
  if (isOneTime(e)) {
    date = new Date(e.year!, e.month - 1, e.day);
  } else {
    // Recurring (anniversaries, and occasions with no year): next occurrence,
    // compared against midnight so one happening today still says "היום".
    date = new Date(today.getFullYear(), e.month - 1, e.day);
    if (date < today) date = new Date(today.getFullYear() + 1, e.month - 1, e.day);
  }
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  const yearNumber =
    type === "anniversary" && e.year != null && date.getFullYear() > e.year
      ? date.getFullYear() - e.year
      : null;
  return { ...e, type, daysUntil: Number.isFinite(days) ? days : NO_DATE, date, yearNumber };
}

/** "12 בנובמבר 2026" — the year only when it isn't this year. */
export function occasionDateLabel(o: Occasion): string {
  if (!o.date) return "";
  const sameYear = o.date.getFullYear() === new Date().getFullYear();
  return o.date.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** "לפני 3 ימים" / "לפני כ-2 חודשים" for occasions that are over. */
export function pastLabel(days: number): string {
  const ago = -days;
  if (ago === 1) return "אתמול";
  if (ago <= 60) return `לפני ${ago} ימים`;
  if (ago < 365) return `לפני כ-${Math.round(ago / 30)} חודשים`;
  const years = Math.round(ago / 365);
  return years === 1 ? "לפני שנה" : `לפני ${years} שנים`;
}
