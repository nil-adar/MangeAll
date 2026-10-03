import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIPS, TIPS_CARD_KEY, TIP_IDS } from "@/components/Tip";

const ease = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * Every tip on one home-page card, one at a time. The in-screen tips show once
 * and are gone; here they can be paged back and forth whenever, until the ✕
 * says "got it". The profile's "הצגת הטיפים מחדש" brings the card back.
 */
export function TipsCard() {
  // Hidden until storage is read after mount, so it never flashes on return visits
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(TIPS_CARD_KEY) === "1");
    } catch {
      setDismissed(false); // storage blocked: show it, it just can't stay closed
    }
  }, []);
  const [index, setIndex] = useState(0);

  if (dismissed) return null;

  const id = TIP_IDS[index]!;
  const tip = TIPS[id];
  const last = TIP_IDS.length - 1;

  function dismiss() {
    try {
      localStorage.setItem(TIPS_CARD_KEY, "1");
    } catch {
      /* storage blocked — hidden for this visit only */
    }
    setDismissed(true);
  }

  const arrowCls =
    "flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-[transform,background-color,color] duration-150 active:scale-[0.9] hover-fine:hover:bg-muted hover-fine:hover:text-foreground disabled:pointer-events-none disabled:opacity-30";

  return (
    <section
      aria-roledescription="קרוסלה"
      aria-label="טיפים"
      className="surface-card rounded-3xl p-5"
      style={{ animation: `fade-up 280ms ${ease} both` }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[1.05rem] font-extrabold tracking-tight">
          טיפים · {index + 1} מתוך {TIP_IDS.length}
        </h2>
        <button
          type="button"
          onClick={dismiss}
          aria-label="הבנתי, להסתיר את הטיפים"
          className="-me-1.5 flex size-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors duration-150 hover-fine:hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Fixed height, so paging between short and long tips doesn't make the page jump */}
      <div className="mt-3 min-h-[5.5rem]" aria-live="polite">
        <div key={id} style={{ animation: `fade-up 220ms ${ease} both` }}>
          <p className="text-[15px] font-bold">{tip.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{tip.text}</p>
          {tip.to && (
            <Link
              to={tip.to}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary transition-transform duration-[140ms] active:scale-[0.94]"
              style={{ transitionTimingFunction: ease }}
            >
              לנסות
              <ArrowLeft className="size-3" />
            </Link>
          )}
        </div>
      </div>

      {/* RTL: back is on the right, forward on the left — the reading direction */}
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          aria-label="הטיפ הקודם"
          className={arrowCls}
          style={{ transitionTimingFunction: ease }}
        >
          <ChevronRight className="size-5" />
        </button>

        <div className="flex items-center gap-1.5">
          {TIP_IDS.map((t, i) => (
            <button
              key={t}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`טיפ ${i + 1}: ${TIPS[t].title}`}
              aria-current={i === index}
              className="flex size-6 items-center justify-center"
            >
              <span
                className={cn(
                  "block h-2 rounded-full transition-[width,background-color] duration-200",
                  i === index ? "w-5 bg-primary" : "w-2 bg-border"
                )}
                style={{ transitionTimingFunction: ease }}
              />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(last, i + 1))}
          disabled={index === last}
          aria-label="הטיפ הבא"
          className={arrowCls}
          style={{ transitionTimingFunction: ease }}
        >
          <ChevronLeft className="size-5" />
        </button>
      </div>
    </section>
  );
}
