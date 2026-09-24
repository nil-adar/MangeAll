import { createFileRoute, Link } from "@tanstack/react-router";
import { Cake, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BirthdayList, useBirthdays } from "@/components/BirthdayList";

export const Route = createFileRoute("/birthdays")({
  component: BirthdaysPage,
});

const ease = "cubic-bezier(0.23, 1, 0.32, 1)";

function BirthdaysPage() {
  const { birthdays, isLoading } = useBirthdays();

  return (
    <AppShell
      title="ימי הולדת"
      subtitle={birthdays.length > 0 ? `${birthdays.length} אנשים` : undefined}
      action={
        <Link
          to="/event/new"
          search={{ type: "birthday", day: undefined }}
          className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground transition-[transform,opacity] active:scale-[0.92]"
          style={{ transitionTimingFunction: ease, transitionDuration: "160ms" }}
        >
          <Plus className="size-3.5" />
          הוסף
        </Link>
      }
    >
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="size-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : birthdays.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-5 flex size-20 items-center justify-center rounded-3xl border border-primary/15 bg-primary/8">
            <Cake className="size-9 text-primary opacity-60" />
          </div>
          <p className="text-lg font-bold mb-1">אין ימי הולדת עדיין</p>
          <p className="text-sm text-muted-foreground mb-6">הוסף כדי לא לשכוח</p>
          <Link
            to="/event/new"
            search={{ type: "birthday", day: undefined }}
            className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-[transform,opacity] active:scale-[0.95]"
            style={{ transitionTimingFunction: ease, transitionDuration: "160ms" }}
          >
            <Plus className="size-4" />
            הוסף יום הולדת ראשון
          </Link>
        </div>
      ) : (
        <div className="pb-8">
          <BirthdayList birthdays={birthdays} />
        </div>
      )}
    </AppShell>
  );
}
