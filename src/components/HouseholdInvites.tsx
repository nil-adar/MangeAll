import { useState } from "react";
import { ShoppingCart, Users } from "lucide-react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import {
  useInviteInfo,
  useJoinByInvite,
  useMyInvites,
  useRespondInvite,
  type EnterResult,
} from "@/lib/queries";

const EASE = "var(--ease-out)";

/** What to say when joining didn't (or couldn't) happen. */
function enterError(result: EnterResult | "error"): string {
  if (result === "in_other_household")
    return "את/ה כבר ברשימה משותפת עם אנשים אחרים. כדי להצטרף לזו, צא/י קודם מהנוכחית (בחלון השיתוף בקניות).";
  if (result === "used") return "הקישור הזה כבר נוצל. כל קישור מתאים לאדם אחד — בקשו ממי ששלח קישור חדש.";
  if (result === "expired") return "עברו 7 ימים והקישור פג. בקשו ממי ששלח קישור חדש.";
  if (result === "not_found") return "ההזמנה כבר לא בתוקף. בקשו הזמנה חדשה.";
  return "ההצטרפות נכשלה. נסה/י שוב.";
}

function memberLine(count: number): string {
  return count <= 1 ? "עוד אין משתתפים נוספים" : `${count} כבר ברשימה`;
}

/**
 * Invites that came by email, as a card at the top of the screen — the
 * invitee decides, no one else. Renders nothing when there are none.
 */
export function IncomingInvites({ className }: { className?: string }) {
  const { data: invites = [] } = useMyInvites();
  const respond = useRespondInvite();
  const [error, setError] = useState<{ id: string; text: string } | null>(null);

  if (invites.length === 0) return null;

  async function answer(id: string, accept: boolean) {
    setError(null);
    try {
      const result = (await respond.mutateAsync({ id, accept })) as EnterResult | "declined";
      if (result !== "joined" && result !== "declined") setError({ id, text: enterError(result) });
    } catch {
      setError({ id, text: enterError("error") });
    }
  }

  return (
    <div className={className}>
      {invites.map((inv) => (
        <section
          key={inv.id}
          className="surface-card rounded-3xl border border-primary/25 p-4"
          style={{ animation: `fade-up 260ms ${EASE} both` }}
          aria-label="הזמנה לרשימה משותפת"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShoppingCart className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">הזמנה מ{inv.inviter} לרשימת הקניות המשותפת</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {memberLine(inv.memberCount)} · כל מה שתוסיפו יופיע אצל כולם מיד
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => answer(inv.id, true)}
              disabled={respond.isPending}
              className="flex-1 rounded-2xl bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-transform duration-150 active:scale-[0.97] disabled:opacity-60"
              style={{ transitionTimingFunction: EASE }}
            >
              להצטרף
            </button>
            <button
              type="button"
              onClick={() => answer(inv.id, false)}
              disabled={respond.isPending}
              className="rounded-2xl bg-muted px-5 py-2.5 text-sm font-bold text-muted-foreground transition-transform duration-150 active:scale-[0.97] disabled:opacity-60"
              style={{ transitionTimingFunction: EASE }}
            >
              לא תודה
            </button>
          </div>
          {error?.id === inv.id && (
            <p className="mt-2 text-xs font-semibold text-destructive" role="alert">{error.text}</p>
          )}
        </section>
      ))}
    </div>
  );
}

/**
 * Opened from an invite link (/shopping?invite=…): who's inviting, and a
 * yes/no. Saying yes is the whole approval — the inviter already chose to send it.
 */
export function InviteLinkSheet({ token, onDone }: { token: string; onDone: () => void }) {
  const [open, setOpen] = useState(true);
  const { data: info, isLoading, isError } = useInviteInfo(token);
  const join = useJoinByInvite();
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    onDone();
  }

  async function accept() {
    setError(null);
    try {
      const result = (await join.mutateAsync(token)) as EnterResult;
      if (result === "joined") close();
      else setError(enterError(result));
    } catch {
      setError(enterError("error"));
    }
  }

  return (
    <Drawer open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DrawerContent className="mx-auto max-w-[30rem]">
        <DrawerHeader className="text-right">
          <DrawerTitle>הזמנה לרשימה משותפת</DrawerTitle>
          <DrawerDescription>
            {info ? "רשימת קניות אחת לכל הבית, שמתעדכנת אצל כולם מיד" : " "}
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-4 px-4 pb-8">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="size-7 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : isError || !info || (info.status !== "ok" && !info.alreadyMember) ? (
            <>
              <p className="py-4 text-center text-sm text-muted-foreground">
                {info && info.status !== "ok"
                  ? enterError(info.status)
                  : "ההזמנה כבר לא בתוקף. בקשו ממי ששלח אותה קישור חדש."}
              </p>
              <button
                type="button"
                onClick={close}
                className="w-full rounded-2xl bg-muted py-3 text-sm font-bold"
              >
                סגירה
              </button>
            </>
          ) : info.alreadyMember ? (
            <>
              <p className="py-4 text-center text-sm font-semibold">את/ה כבר ברשימה הזו ✓</p>
              <button
                type="button"
                onClick={close}
                className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground"
              >
                לרשימה
              </button>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <span className="flex size-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                  <Users className="size-6" />
                </span>
                <p className="text-base font-bold">{info.inviter} מזמין/ה אותך לרשימת הקניות שלו/ה</p>
                <p className="text-xs text-muted-foreground">
                  {memberLine(info.memberCount)}. גם הפריטים שכבר ברשימה שלך יעברו לרשימה המשותפת.
                </p>
              </div>
              {error && <p className="text-center text-xs font-semibold text-destructive" role="alert">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={accept}
                  disabled={join.isPending}
                  className="flex-1 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition-transform duration-150 active:scale-[0.97] disabled:opacity-60"
                  style={{ transitionTimingFunction: EASE }}
                >
                  {join.isPending ? "מצטרף..." : "להצטרף"}
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-2xl bg-muted px-6 py-3.5 text-sm font-bold text-muted-foreground"
                >
                  לא עכשיו
                </button>
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
