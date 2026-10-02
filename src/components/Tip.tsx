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

/** Every tip in the app — resetTips() clears exactly these. */
export const TIP_IDS = ["shopping-mode", "edit-event", "quick-add"] as const;
export type TipId = (typeof TIP_IDS)[number];

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
  } catch {
    /* storage blocked — nothing was stored either */
  }
}

export function Tip({
  id,
  title,
  children,
  className,
}: {
  id: TipId;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
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
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed opacity-80">{children}</p>
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
