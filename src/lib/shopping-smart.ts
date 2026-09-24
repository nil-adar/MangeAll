/**
 * Shopping list "smarts" — pure functions, no React, no network.
 *
 *  - parseItem("3 חלב")          → { title: "חלב", quantity: 3, unit: null }
 *  - categorize("עגבניות")        → "ירקות"
 *  - history (localStorage)       → autocomplete + "your staples"
 */

// ── Categories, in supermarket walking order ─────────────────────────────────
// The order here is the order groups appear in the list.

export const CATEGORY_ORDER = [
  "ירקות",
  "לחם",
  "חלב",
  "בשר",
  "מזווה",
  "משקאות",
  "קפואים",
  "ניקיון",
  "כללי",
] as const;

export type CategoryKey = (typeof CATEGORY_ORDER)[number];

export const CATEGORY_LABEL: Record<CategoryKey, string> = {
  ירקות: "ירקות ופירות",
  לחם: "לחם ומאפים",
  חלב: "חלב וביצים",
  בשר: "בשר ודגים",
  מזווה: "מזווה",
  משקאות: "משקאות",
  קפואים: "קפואים",
  ניקיון: "ניקיון ופארם",
  כללי: "כללי",
};

/** Normalise any stored category (including unknown/legacy ones) to a key. */
export function toCategory(raw: string | null | undefined): CategoryKey {
  return (CATEGORY_ORDER as readonly string[]).includes(raw ?? "")
    ? (raw as CategoryKey)
    : "כללי";
}

// ── Auto-categorisation ──────────────────────────────────────────────────────
// Keyword stems. Matching is "the item contains the stem", so "עגבניות שרי"
// hits "עגבני". Longer / more specific stems are checked first.

const KEYWORDS: Record<Exclude<CategoryKey, "כללי">, string[]> = {
  ירקות: [
    "עגבני", "מלפפו", "בצל", "שום", "גזר", "תפוח אדמה", "תפו\"א", "תפוא", "חסה", "כרוב",
    "פלפל", "קישוא", "חציל", "ברוקולי", "כרובית", "פטרוזיליה", "כוסברה", "שמיר", "נענע",
    "לימון", "תפוח", "תפוז", "בננ", "ענב", "אבטיח", "מלון", "אגס", "אפרסק", "שזיף",
    "תות", "אבוקדו", "מנגו", "קלמנטינ", "רימון", "פטריות", "בטטה", "סלק", "תירס", "ירק", "פרי", "פירות",
  ],
  לחם: [
    "לחם", "לחמני", "פיתה", "פיתות", "באגט", "חלה", "חלות", "טורטיי", "קרואסון", "מאפ",
    "עוגה", "עוגיות", "בורקס", "לאפה", "פוקאצ",
  ],
  חלב: [
    "חלב", "גבינ", "קוטג", "יוגורט", "לבן", "לבנה", "שמנת", "חמאה", "ביצים", "ביצה",
    "מעדן", "מילקי", "צפתית", "בולגרית", "מוצרל", "פרמזן", "אשל", "גיל", "משקה סויה", "חלב שקדים",
  ],
  בשר: [
    "עוף", "חזה", "שניצל", "בשר", "טחון", "קבב", "נקניק", "סטייק", "אנטריקוט", "כבד",
    "דג", "סלמון", "טונה טרי", "אמנון", "הודו", "פרגית", "שוקיים", "כנפיים", "המבורגר",
  ],
  מזווה: [
    "אורז", "פסטה", "ספגטי", "קמח", "סוכר", "מלח", "שמן", "חומץ", "קפה", "תה", "קקאו",
    "דבש", "ריבה", "שוקולד", "ממרח", "טחינה", "חומוס", "עדשים", "שעועית", "קטניות", "טונה",
    "תירס שימורים", "רסק", "רוטב", "קטשופ", "מיונז", "חרדל", "תבלין", "פפריקה", "כמון",
    "קורנפלקס", "דגני", "שיבולת", "גרנולה", "במבה", "ביסלי", "חטיף", "צ'יפס", "קרקר",
    "אגוז", "שקדים", "בוטנים", "צימוק", "פתיתים", "קוסקוס", "בורגול", "קינואה", "אטריות",
  ],
  משקאות: [
    "מים", "סודה", "קולה", "ספרייט", "מיץ", "משקה", "בירה", "יין", "תפוזים", "פטל", "אייס",
  ],
  קפואים: [
    "קפוא", "גלידה", "ארטיק", "פיצה קפואה", "ירקות קפואים", "אפונה", "שעועית ירוקה קפואה", "בצק",
  ],
  ניקיון: [
    "סבון", "שמפו", "מרכך", "אקונומיקה", "נוזל כלים", "אבקת כביסה", "ג'ל כביסה", "מרכך כביסה",
    "נייר טואלט", "טואלט", "מגבות", "מגבונים", "שקיות", "נייר כסף", "ניילון", "ספוג",
    "משחת שיניים", "מברשת", "דאודורנט", "טיטולים", "חיתולים", "טמפונים", "תחבושות", "ניקוי", "סנו",
  ],
};

// Flatten once, longest stem first so "חלב שקדים" wins over "חלב".
const STEMS: Array<[string, CategoryKey]> = Object.entries(KEYWORDS)
  .flatMap(([cat, words]) => words.map((w) => [w, cat as CategoryKey] as [string, CategoryKey]))
  .sort((a, b) => b[0].length - a[0].length);

export function categorize(title: string): CategoryKey {
  const t = title.trim();
  if (!t) return "כללי";
  // History wins: if the user filed this item before, reuse their choice.
  const known = getHistory()[normalize(t)];
  if (known) return toCategory(known.category);
  for (const [stem, cat] of STEMS) {
    if (t.includes(stem)) return cat;
  }
  return "כללי";
}

// ── Quick-entry parsing ──────────────────────────────────────────────────────
// Accepts:  "3 חלב"  "חלב 3"  "חלב x2"  "2x חלב"  "חלב ×2"
//           "1.5 ק״ג עגבניות"  "עגבניות 2 ק\"ג"  "חצי ק״ג גבינה"

export const UNITS = ["יח׳", "ק״ג", "גרם", "ליטר", "מ״ל", "אריזה", "כיכר", "צרור", "בקבוק"] as const;

// Every spelling people type → the canonical unit above
const UNIT_ALIASES: Array<[RegExp, string]> = [
  [/^(ק["״']?ג|קג|קילו|קילוגרם|kg)$/i, "ק״ג"],
  [/^(גרם|גר|ג['׳]?|g)$/i, "גרם"],
  [/^(ליטר|ל['׳]?|l)$/i, "ליטר"],
  [/^(מ["״']?ל|מל|ml)$/i, "מ״ל"],
  [/^(יח['׳]?|יחידות|יחידה)$/, "יח׳"],
  [/^(אריזה|אריזות|חבילה|חבילות)$/, "אריזה"],
  [/^(בקבוק|בקבוקים)$/, "בקבוק"],
  [/^(כיכר|כיכרות)$/, "כיכר"],
  [/^(צרור|צרורות)$/, "צרור"],
];

function asUnit(word: string): string | null {
  for (const [re, unit] of UNIT_ALIASES) if (re.test(word)) return unit;
  return null;
}

const WORD_NUMBERS: Record<string, number> = {
  חצי: 0.5, רבע: 0.25, אחד: 1, אחת: 1, שניים: 2, שתיים: 2, שני: 2, שתי: 2,
  שלוש: 3, שלושה: 3, ארבע: 4, ארבעה: 4, חמש: 5, חמישה: 5, שש: 6, שישה: 6,
  שבע: 7, שבעה: 7, שמונה: 8, תשע: 9, תשעה: 9, עשר: 10, עשרה: 10, תריסר: 12,
};

function asNumber(word: string): number | null {
  const m = word.match(/^[x×*]?(\d+(?:[.,]\d+)?)[x×*]?$/i);
  if (m) {
    const n = parseFloat(m[1]!.replace(",", "."));
    return n > 0 ? n : null;
  }
  return WORD_NUMBERS[word] ?? null;
}

export type ParsedItem = { title: string; quantity: number; unit: string | null };

export function parseItem(input: string): ParsedItem {
  const words = input.trim().split(/\s+/).filter(Boolean);
  let quantity: number | null = null;
  let unit: string | null = null;
  const rest: string[] = [];

  for (const w of words) {
    if (quantity === null) {
      const n = asNumber(w);
      if (n !== null) { quantity = n; continue; }
    }
    if (unit === null) {
      const u = asUnit(w);
      if (u !== null) { unit = u; continue; }
    }
    // "x" on its own, as in "חלב x 2"
    if (/^[x×*]$/i.test(w)) continue;
    rest.push(w);
  }

  const title = rest.join(" ").trim();
  // A bare number with nothing else ("3") is a title, not a quantity
  if (!title) return { title: input.trim(), quantity: 1, unit: null };
  return { title, quantity: quantity ?? 1, unit };
}

export function normalize(title: string): string {
  return title.trim().replace(/\s+/g, " ");
}

// ── History (per device) ─────────────────────────────────────────────────────
// Every add is counted, so frequently bought items become "staples" and feed
// autocomplete. Stored in localStorage: it's a convenience, and the list
// itself still lives in Supabase. Every access is guarded — storage can be
// unavailable (private mode, blocked) and the page must still work.

const KEY = "nahel-hakol:shopping-history:v1";

export type HistoryEntry = { count: number; category: string; unit: string | null; last: number };
type History = Record<string, HistoryEntry>;

export function getHistory(): History {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    return raw ? (JSON.parse(raw) as History) : {};
  } catch {
    return {};
  }
}

export function recordPurchase(title: string, category: string, unit: string | null): void {
  try {
    const h = getHistory();
    const k = normalize(title);
    const prev = h[k];
    h[k] = { count: (prev?.count ?? 0) + 1, category, unit: unit ?? prev?.unit ?? null, last: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(h));
  } catch {
    /* storage unavailable — smart features degrade, list still works */
  }
}

/** Items bought at least `min` times, most frequent first. */
export function getStaples(min = 2, limit = 10): Array<{ title: string } & HistoryEntry> {
  return Object.entries(getHistory())
    .filter(([, e]) => e.count >= min)
    .sort((a, b) => b[1].count - a[1].count || b[1].last - a[1].last)
    .slice(0, limit)
    .map(([title, e]) => ({ title, ...e }));
}

/** Starter set shown before there's any history. */
export const STARTER_STAPLES: Array<{ title: string; category: CategoryKey; unit: string | null }> = [
  { title: "לחם", category: "לחם", unit: "כיכר" },
  { title: "חלב", category: "חלב", unit: null },
  { title: "ביצים", category: "חלב", unit: "אריזה" },
  { title: "עגבניות", category: "ירקות", unit: "ק״ג" },
  { title: "מלפפונים", category: "ירקות", unit: "ק״ג" },
  { title: "גבינה לבנה", category: "חלב", unit: null },
  { title: "בננות", category: "ירקות", unit: null },
  { title: "נייר טואלט", category: "ניקיון", unit: "אריזה" },
];

// Real product names for autocomplete from day one. (Not the KEYWORDS above —
// those are stems like "עגבני", which match text but aren't words to suggest.)
const VOCAB = [
  "עגבניות", "עגבניות שרי", "מלפפונים", "בצל", "בצל ירוק", "שום", "גזר", "תפוחי אדמה", "בטטה",
  "חסה", "כרוב", "פלפל אדום", "פלפל ירוק", "קישואים", "חצילים", "ברוקולי", "כרובית", "פטרוזיליה",
  "כוסברה", "שמיר", "נענע", "לימון", "תפוחים", "תפוזים", "בננות", "ענבים", "אבטיח", "אבוקדו",
  "תותים", "פטריות", "לחם", "לחם מלא", "לחמניות", "פיתות", "חלה", "באגט", "טורטיות",
  "חלב", "חלב שקדים", "גבינה לבנה", "גבינה צהובה", "קוטג'", "יוגורט", "לבן", "לבנה", "שמנת",
  "שמנת מתוקה", "חמאה", "ביצים", "מעדנים", "חזה עוף", "שניצל", "בשר טחון", "פרגיות", "שוקיים",
  "כנפיים", "נקניקיות", "סלמון", "טונה", "אורז", "פסטה", "ספגטי", "קמח", "סוכר", "מלח", "שמן זית",
  "שמן קנולה", "חומץ", "קפה", "תה", "דבש", "ריבה", "שוקולד", "טחינה", "חומוס", "עדשים", "שעועית",
  "רסק עגבניות", "קטשופ", "מיונז", "חרדל", "פפריקה", "כמון", "קורנפלקס", "שיבולת שועל", "במבה",
  "ביסלי", "קרקרים", "אגוזים", "שקדים", "פתיתים", "קוסקוס", "מים", "סודה", "קולה", "מיץ תפוזים",
  "בירה", "יין", "גלידה", "אפונה קפואה", "פיצה קפואה", "בצק עלים", "סבון כלים", "סבון ידיים",
  "שמפו", "מרכך", "אבקת כביסה", "מרכך כביסה", "אקונומיקה", "נייר טואלט", "מגבות נייר", "מגבונים",
  "שקיות אשפה", "נייר כסף", "ניילון נצמד", "ספוגים", "משחת שיניים", "מברשות שיניים", "דאודורנט", "חיתולים",
];

/** Up to `limit` completions: history (by frequency) first, then vocabulary. */
export function suggest(prefix: string, limit = 5): string[] {
  const p = normalize(prefix);
  if (p.length < 1) return [];
  const fromHistory = Object.entries(getHistory())
    .filter(([t]) => t.startsWith(p) && t !== p)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([t]) => t);
  const fromVocab = VOCAB.filter((w) => w.startsWith(p) && w !== p);
  return Array.from(new Set([...fromHistory, ...fromVocab])).slice(0, limit);
}
