import { Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";

const ease = "cubic-bezier(0.23, 1, 0.32, 1)";

/**
 * The pencil beside an event's delete button: opens it in the add form, filled
 * in (event.new.tsx, ?edit=<id>). The form is picked from the event itself, so
 * the same button serves events, birthdays and שמחות.
 */
export function EditEventButton({ id, title }: { id: string; title: string }) {
  return (
    <Link
      to="/event/new"
      search={{ type: "event", edit: id }}
      aria-label={`עריכת ${title}`}
      title="עריכה"
      className="shrink-0 rounded-full p-1.5 text-muted-foreground/60 transition-[background-color,color,transform] duration-[160ms] hover:bg-muted hover:text-primary active:scale-[0.85]"
      style={{ transitionTimingFunction: ease }}
    >
      <Pencil className="size-3.5" />
    </Link>
  );
}
