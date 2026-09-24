// Israeli holidays — Gregorian dates for 2024–2026
// type: "holiday" = yom tov (day off) | "memorial" = remembrance/national day | "eve" = erev chag

export type Holiday = {
  year: number;
  month: number; // 1-based
  day: number;
  name: string;
  emoji: string;
  type: "holiday" | "memorial" | "eve";
};

export const HOLIDAYS: Holiday[] = [
  // ── 5785 (2024–2025) ───────────────────────────────────────────────────────
  { year: 2024, month: 10, day: 2,  name: "ראש השנה",        emoji: "🍎", type: "holiday" },
  { year: 2024, month: 10, day: 3,  name: "ראש השנה ב׳",     emoji: "🍎", type: "holiday" },
  { year: 2024, month: 10, day: 11, name: "ערב יום כיפור",   emoji: "🕯️", type: "eve" },
  { year: 2024, month: 10, day: 12, name: "יום כיפור",       emoji: "✡️", type: "holiday" },
  { year: 2024, month: 10, day: 16, name: "סוכות",           emoji: "🌿", type: "holiday" },
  { year: 2024, month: 10, day: 23, name: "שמיני עצרת",      emoji: "✡️", type: "holiday" },
  { year: 2024, month: 10, day: 24, name: "שמחת תורה",       emoji: "📜", type: "holiday" },
  { year: 2024, month: 12, day: 25, name: "חנוכה — נר א׳",   emoji: "🕎", type: "holiday" },
  { year: 2024, month: 12, day: 26, name: "חנוכה — נר ב׳",   emoji: "🕎", type: "holiday" },
  { year: 2024, month: 12, day: 27, name: "חנוכה — נר ג׳",   emoji: "🕎", type: "holiday" },
  { year: 2024, month: 12, day: 28, name: "חנוכה — נר ד׳",   emoji: "🕎", type: "holiday" },
  { year: 2024, month: 12, day: 29, name: "חנוכה — נר ה׳",   emoji: "🕎", type: "holiday" },
  { year: 2024, month: 12, day: 30, name: "חנוכה — נר ו׳",   emoji: "🕎", type: "holiday" },
  { year: 2024, month: 12, day: 31, name: "חנוכה — נר ז׳",   emoji: "🕎", type: "holiday" },
  { year: 2025, month: 1,  day: 1,  name: "חנוכה — נר ח׳",   emoji: "🕎", type: "holiday" },
  { year: 2025, month: 2,  day: 13, name: "טו בשבט",          emoji: "🌳", type: "memorial" },
  { year: 2025, month: 3,  day: 13, name: "ערב פורים",        emoji: "🎭", type: "eve" },
  { year: 2025, month: 3,  day: 14, name: "פורים",            emoji: "🎭", type: "holiday" },
  { year: 2025, month: 4,  day: 12, name: "ערב פסח",          emoji: "🍷", type: "eve" },
  { year: 2025, month: 4,  day: 13, name: "פסח — יום א׳",     emoji: "🍷", type: "holiday" },
  { year: 2025, month: 4,  day: 14, name: "פסח — יום ב׳",     emoji: "🍷", type: "holiday" },
  { year: 2025, month: 4,  day: 18, name: "חול המועד פסח",    emoji: "🍷", type: "holiday" },
  { year: 2025, month: 4,  day: 19, name: "פסח — יום ז׳",     emoji: "🍷", type: "holiday" },
  { year: 2025, month: 4,  day: 20, name: "פסח — יום ח׳",     emoji: "🍷", type: "holiday" },
  { year: 2025, month: 4,  day: 24, name: "יום השואה",         emoji: "🕯️", type: "memorial" },
  { year: 2025, month: 4,  day: 30, name: "יום הזיכרון",       emoji: "🪖", type: "memorial" },
  { year: 2025, month: 5,  day: 1,  name: "יום העצמאות",       emoji: "🇮🇱", type: "holiday" },
  { year: 2025, month: 5,  day: 16, name: "ל״ג בעומר",         emoji: "🔥", type: "memorial" },
  { year: 2025, month: 5,  day: 28, name: "יום ירושלים",       emoji: "🕍", type: "memorial" },
  { year: 2025, month: 6,  day: 1,  name: "ערב שבועות",        emoji: "📜", type: "eve" },
  { year: 2025, month: 6,  day: 2,  name: "שבועות",            emoji: "📜", type: "holiday" },
  { year: 2025, month: 6,  day: 3,  name: "שבועות ב׳",         emoji: "📜", type: "holiday" },
  { year: 2025, month: 8,  day: 12, name: "תשעה באב",          emoji: "🕯️", type: "memorial" },

  // ── 5786 (2025–2026) ───────────────────────────────────────────────────────
  { year: 2025, month: 9,  day: 22, name: "ראש השנה",          emoji: "🍎", type: "holiday" },
  { year: 2025, month: 9,  day: 23, name: "ראש השנה ב׳",       emoji: "🍎", type: "holiday" },
  { year: 2025, month: 10, day: 1,  name: "ערב יום כיפור",     emoji: "🕯️", type: "eve" },
  { year: 2025, month: 10, day: 2,  name: "יום כיפור",         emoji: "✡️", type: "holiday" },
  { year: 2025, month: 10, day: 6,  name: "סוכות",             emoji: "🌿", type: "holiday" },
  { year: 2025, month: 10, day: 7,  name: "סוכות ב׳",          emoji: "🌿", type: "holiday" },
  { year: 2025, month: 10, day: 13, name: "שמיני עצרת",        emoji: "✡️", type: "holiday" },
  { year: 2025, month: 10, day: 14, name: "שמחת תורה",         emoji: "📜", type: "holiday" },
  { year: 2025, month: 12, day: 14, name: "חנוכה — נר א׳",     emoji: "🕎", type: "holiday" },
  { year: 2025, month: 12, day: 15, name: "חנוכה — נר ב׳",     emoji: "🕎", type: "holiday" },
  { year: 2025, month: 12, day: 16, name: "חנוכה — נר ג׳",     emoji: "🕎", type: "holiday" },
  { year: 2025, month: 12, day: 17, name: "חנוכה — נר ד׳",     emoji: "🕎", type: "holiday" },
  { year: 2025, month: 12, day: 18, name: "חנוכה — נר ה׳",     emoji: "🕎", type: "holiday" },
  { year: 2025, month: 12, day: 19, name: "חנוכה — נר ו׳",     emoji: "🕎", type: "holiday" },
  { year: 2025, month: 12, day: 20, name: "חנוכה — נר ז׳",     emoji: "🕎", type: "holiday" },
  { year: 2025, month: 12, day: 21, name: "חנוכה — נר ח׳",     emoji: "🕎", type: "holiday" },
  { year: 2026, month: 2,  day: 1,  name: "טו בשבט",            emoji: "🌳", type: "memorial" },
  { year: 2026, month: 3,  day: 3,  name: "ערב פורים",          emoji: "🎭", type: "eve" },
  { year: 2026, month: 3,  day: 4,  name: "פורים",              emoji: "🎭", type: "holiday" },
  { year: 2026, month: 4,  day: 1,  name: "פסח — יום א׳",       emoji: "🍷", type: "holiday" },
  { year: 2026, month: 4,  day: 2,  name: "פסח — יום ב׳",       emoji: "🍷", type: "holiday" },
  { year: 2026, month: 4,  day: 7,  name: "פסח — יום ז׳",       emoji: "🍷", type: "holiday" },
  { year: 2026, month: 4,  day: 8,  name: "פסח — יום ח׳",       emoji: "🍷", type: "holiday" },
  { year: 2026, month: 4,  day: 16, name: "יום השואה",           emoji: "🕯️", type: "memorial" },
  { year: 2026, month: 4,  day: 21, name: "יום הזיכרון",         emoji: "🪖", type: "memorial" },
  { year: 2026, month: 4,  day: 22, name: "יום העצמאות",         emoji: "🇮🇱", type: "holiday" },
  { year: 2026, month: 5,  day: 6,  name: "ל״ג בעומר",           emoji: "🔥", type: "memorial" },
  { year: 2026, month: 5,  day: 20, name: "יום ירושלים",         emoji: "🕍", type: "memorial" },
  { year: 2026, month: 5,  day: 21, name: "שבועות",              emoji: "📜", type: "holiday" },
  { year: 2026, month: 5,  day: 22, name: "שבועות ב׳",           emoji: "📜", type: "holiday" },
  { year: 2026, month: 7,  day: 22, name: "תשעה באב",            emoji: "🕯️", type: "memorial" },
];

export function getHolidaysForMonth(year: number, month: number): Holiday[] {
  return HOLIDAYS.filter((h) => h.year === year && h.month === month);
}

export function getHolidaysForDay(year: number, month: number, day: number): Holiday[] {
  return HOLIDAYS.filter((h) => h.year === year && h.month === month && h.day === day);
}
