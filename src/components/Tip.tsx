import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One-time hints for features that aren't obvious from the screen itself.
 * Each shows the first time its feature is in view, until closed — then never
 * again on this device. Rules: no more than a handful in the whole app, and
 * never two on the same screen. The profile can bring them all back.
 */
const PREFIX = "nahel-hakol:tip:";

/** Every tip in the app, in the order the home-page tips card pages through them. */
export const TIP_IDS = ["quick-add", "edit-event", "shopping-mode", "workday-report"] as const;
export type TipId = (typeof TIP_IDS)[number];

/**
 * The wording, in one place: the in-screen tip and the home-page card
 * (components/TipsCard.tsx) say the same thing. `to` is where the card's
 * "לנסות" link goes; none when the feature isn't a page of its own.
 */
export const TIPS: Record<TipId, { title: string; text: string; to?: "/calendar" | "/shopping" | "/workday" }> = {
  "quick-add": {
    title: "הכול מכאן",
    text: "משימה, אירוע, יום הולדת, הוצאה או פריט לקניות, מכל מסך באפליקציה.",
  },
  "edit-event": {
    title: "אפשר לערוך כל אירוע",
    text: "לחיצה על אירוע, או על העיפרון שלידו, פותחת אותו לשינוי שעה, מקום או תאריך.",
    to: "/calendar",
  },
  "shopping-mode": {
    title: "מצב קנייה",
    text: "נגיעה בפריט מעבירה אותו לעגלה, והמסך יישאר דולק עד שתלחצו ״סיום״.",
    to: "/shopping",
  },
  // Card-only: the report button is plain to see once you're on the page
  "workday-report": {
    title: "דוח ימי עבודה",
    text: "בסוף החודש, ״ייצוא דוח״ בעמוד ימי העבודה מדפיס את החודש או שומר אותו כ-PDF.",
    to: "/workday",
  },
};

/** The home-page tips card, closed with its ✕ (components/TipsCard.tsx). */
export const TIPS_CARD_KEY = "nahel-hakol:tips-card-dismissed";

function isSeen(id: TipId): boolean {
  try {
    return localStorage.getItem(PREFIX + id) === "1";
  } catch {
    return true; // storage blocked: better never than every single visit
  }
}

export function resetTips() {
  try {
    for (const id of TIP_IDS) localStorage.removeItem(PREFIX + id);
    localStorage.removeItem(TIPS_CARD_KEY);
  } catch {
    /* storage blocked — nothing was stored either */
  }
}

export function Tip({ id, className }: { id: TipId; className?: string }) {
  // Read after mount, not during render: the stored state only exists in the
  // browser, and hidden-first means it never flashes on a return visit.
  const [hidden, setHidden] = useState(true);
  useEffect(() => setHidden(isSeen(id)), [id]);
  if (hidden) return null;

  function close() {
    try {
      localStorage.setItem(PREFIX + id, "1");
    } catch {
      /* storage blocked — it simply shows again next time */
    }
    setHidden(true);
  }

  return (
    <div
      role="note"
      className={cn(
        "relative rounded-2xl bg-foreground px-4 py-3 pe-11 text-background shadow-[var(--shadow-float)]",
        className
      )}
      style={{ animation: "fade-up 260ms var(--ease-out) both" }}
    >
      <p className="text-sm font-bold">{TIPS[id].title}</p>
      <p className="mt-0.5 text-xs leading-relaxed opacity-80">{TIPS[id].text}</p>
      <button
        type="button"
        onClick={close}
        aria-label="סגירת הטיפ"
        className="absolute end-2 top-2 rounded-full p-1.5 opacity-70 transition-opacity duration-150 hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
