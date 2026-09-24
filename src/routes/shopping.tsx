import { useState, useRef, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Carrot, Croissant, Milk, Beef, Wheat, CupSoda, Snowflake, SprayCan, ShoppingBasket,
  ShoppingCart, Plus, Minus, X, Check, Repeat2, ChevronDown, PartyPopper,
  Users, Copy, Share2, LogOut, UserCheck, Clock3,
} from "lucide-react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import { AppShell } from "@/components/AppShell";
import {
  useShoppingItems,
  useAddShoppingItem,
  useToggleShoppingItem,
  useDeleteShoppingItem,
  useClearCheckedShoppingItems,
  useUpdateShoppingQuantity,
  useHousehold,
  useHouseholdPeople,
  useCreateHousehold,
  useJoinHousehold,
  useLeaveHousehold,
  useApproveMember,
  useRemoveMember,
  useShoppingRealtime,
  type ShoppingItem,
} from "@/lib/queries";
import {
  CATEGORY_ORDER, CATEGORY_LABEL, type CategoryKey, toCategory, categorize, parseItem,
  normalize, recordPurchase, getStaples, STARTER_STAPLES, suggest,
} from "@/lib/shopping-smart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/shopping")({
  component: ShoppingPage,
});

const EASE = "var(--ease-out)";

const CAT_STYLE: Record<CategoryKey, { icon: typeof Carrot; tint: string }> = {
  ירקות:  { icon: Carrot,         tint: "bg-emerald-500/10 text-emerald-600" },
  לחם:    { icon: Croissant,      tint: "bg-amber-500/12 text-amber-600" },
  חלב:    { icon: Milk,           tint: "bg-sky-500/10 text-sky-600" },
  בשר:    { icon: Beef,           tint: "bg-rose-500/10 text-rose-600" },
  מזווה:  { icon: Wheat,          tint: "bg-orange-500/10 text-orange-600" },
  משקאות: { icon: CupSoda,        tint: "bg-indigo-500/10 text-indigo-600" },
  קפואים: { icon: Snowflake,      tint: "bg-cyan-500/10 text-cyan-600" },
  ניקיון: { icon: SprayCan,       tint: "bg-violet-500/10 text-violet-600" },
  כללי:   { icon: ShoppingBasket, tint: "bg-muted text-muted-foreground" },
};

function CatIcon({ cat, size = "md" }: { cat: CategoryKey; size?: "sm" | "md" }) {
  const { icon: Icon, tint } = CAT_STYLE[cat];
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-xl", tint, size === "sm" ? "size-7" : "size-9")}>
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} />
    </span>
  );
}

function qtyLabel(quantity: number, unit: string | null): string | null {
  const n = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1).replace(/\.0$/, "");
  if (unit) return `${n} ${unit}`;
  return quantity > 1 ? `×${n}` : null;
}

/** Group items by category, in supermarket walking order. */
function groupByAisle(items: ShoppingItem[]) {
  return CATEGORY_ORDER
    .map((cat) => ({ cat, items: items.filter((i) => toCategory(i.category) === cat) }))
    .filter((g) => g.items.length > 0);
}

// ── Quick add ────────────────────────────────────────────────────────────────

function QuickAdd({ items }: { items: ShoppingItem[] }) {
  const add = useAddShoppingItem();
  const updateQty = useUpdateShoppingQuantity();
  const inputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [catOverride, setCatOverride] = useState<CategoryKey | null>(null);
  const [pickingCat, setPickingCat] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const parsed = parseItem(text);
  const autoCat = parsed.title ? categorize(parsed.title) : "כללי";
  const cat = catOverride ?? autoCat;
  const completions = text.trim() ? suggest(parsed.title).slice(0, 4) : [];

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 1800);
    return () => clearTimeout(t);
  }, [note]);

  async function submit(raw = text) {
    const p = parseItem(raw);
    if (!p.title) return;
    const category = catOverride ?? categorize(p.title);

    // Same item already on the list? Bump its quantity instead of a duplicate row.
    const existing = items.find((i) => !i.checked && normalize(i.title) === normalize(p.title));
    if (existing) {
      updateQty.mutate({ id: existing.id, quantity: existing.quantity + p.quantity });
      setNote(`${p.title}: הכמות עודכנה ל-${existing.quantity + p.quantity}`);
    } else {
      await add.mutateAsync({ title: p.title, quantity: p.quantity, unit: p.unit, category, checked: false });
    }
    recordPurchase(p.title, category, p.unit);
    setText("");
    setCatOverride(null);
    setPickingCat(false);
    inputRef.current?.focus();
  }

  return (
    <div className="surface-card rounded-3xl p-2">
      <div className="flex items-center gap-2 pr-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => { setText(e.target.value); setCatOverride(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder='מה צריך? למשל "3 חלב" או "1 ק״ג עגבניות"'
          enterKeyHint="done"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground"
          aria-label="הוספת פריט"
        />
        <button
          onClick={() => submit()}
          disabled={!parsed.title || add.isPending}
          aria-label="הוסף"
          className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground transition-opacity duration-150 disabled:opacity-35"
        >
          <Plus className="size-5" />
        </button>
      </div>

      {/* Live preview: what the parser understood. Tap the category to change it. */}
      {text.trim() && (
        <div className="px-2 pb-1 pt-1" style={{ animation: `fade-in 150ms ${EASE} both` }}>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setPickingCat((v) => !v)}
              className="flex items-center gap-1.5 rounded-full bg-muted py-1 pl-2.5 pr-1 font-semibold"
              aria-label="שינוי מחלקה"
            >
              <CatIcon cat={cat} size="sm" />
              {CATEGORY_LABEL[cat]}
              <ChevronDown className={cn("size-3 transition-transform duration-150", pickingCat && "rotate-180")} />
            </button>
            {qtyLabel(parsed.quantity, parsed.unit) && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 font-bold text-primary tabular-nums">
                {qtyLabel(parsed.quantity, parsed.unit)}
              </span>
            )}
          </div>

          {pickingCat && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CATEGORY_ORDER.map((k) => (
                <button
                  key={k}
                  onClick={() => { setCatOverride(k); setPickingCat(false); inputRef.current?.focus(); }}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors duration-150",
                    k === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {CATEGORY_LABEL[k]}
                </button>
              ))}
            </div>
          )}

          {completions.length > 0 && !pickingCat && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {completions.map((c) => {
                // Keep the typed quantity: "3 עג" + tap "עגבניות" → "3 עגבניות"
                const withQty = parsed.quantity !== 1 || parsed.unit
                  ? `${parsed.quantity} ${parsed.unit ?? ""} ${c}`.replace(/\s+/g, " ")
                  : c;
                return (
                  <button
                    key={c}
                    onClick={() => submit(withQty)}
                    className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold transition-colors duration-150 hover-fine:hover:border-primary/40"
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {note && (
        <p className="px-3 pb-1.5 pt-1 text-xs font-semibold text-success" aria-live="polite">{note}</p>
      )}
    </div>
  );
}

// ── Staples ──────────────────────────────────────────────────────────────────

function Staples({ items }: { items: ShoppingItem[] }) {
  const add = useAddShoppingItem();
  const [open, setOpen] = useState(true);

  const onList = new Set(items.filter((i) => !i.checked).map((i) => normalize(i.title)));
  const history = getStaples();
  const fromHistory = history.length > 0;
  const staples = (fromHistory
    ? history.map((h) => ({ title: h.title, category: toCategory(h.category), unit: h.unit }))
    : STARTER_STAPLES
  ).filter((s) => !onList.has(normalize(s.title)));

  if (staples.length === 0) return null;

  function addOne(s: (typeof staples)[number]) {
    add.mutate({ title: s.title, quantity: 1, unit: s.unit, category: s.category, checked: false });
    recordPurchase(s.title, s.category, s.unit);
  }

  return (
    <section className="surface-card rounded-3xl p-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 text-sm font-bold">
          <Repeat2 className="size-4 text-primary" />
          {fromHistory ? "הקבועים שלך" : "להתחלה מהירה"}
          <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform duration-150", !open && "-rotate-90")} />
        </button>
        {open && staples.length > 1 && (
          <button
            onClick={() => staples.forEach(addOne)}
            disabled={add.isPending}
            className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"
          >
            הוסף הכל ({staples.length})
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap gap-2">
          {staples.map((s) => (
            <button
              key={s.title}
              onClick={() => addOne(s)}
              className="flex items-center gap-1.5 rounded-full bg-muted py-1 pl-3 pr-1 text-xs font-semibold transition-colors duration-150 hover-fine:hover:bg-border/70"
            >
              <CatIcon cat={s.category} size="sm" />
              {s.title}
              <Plus className="size-3 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
      {open && !fromHistory && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          אחרי כמה קניות, כאן יופיעו המוצרים שאתה קונה הכי הרבה
        </p>
      )}
    </section>
  );
}

// ── Item row ─────────────────────────────────────────────────────────────────

function ItemRow({ item, shopping }: { item: ShoppingItem; shopping: boolean }) {
  const toggle = useToggleShoppingItem();
  const del = useDeleteShoppingItem();
  const updateQty = useUpdateShoppingQuantity();
  const label = qtyLabel(item.quantity, item.unit);
  const step = item.unit === "ק״ג" || item.unit === "ליטר" ? 0.5 : 1;

  const check = (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 transition-[background-color,border-color] duration-150",
        shopping ? "size-7" : "size-6",
        item.checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
      )}
      style={{ transitionTimingFunction: EASE }}
    >
      <Check
        className={cn("transition-[opacity,transform] duration-150", shopping ? "size-4" : "size-3.5")}
        style={{
          transitionTimingFunction: EASE,
          opacity: item.checked ? 1 : 0,
          transform: item.checked ? "scale(1)" : "scale(0.9)",
        }}
        strokeWidth={3}
      />
    </span>
  );

  // Shopping mode: the whole row is one big tap target, nothing else to hit.
  if (shopping) {
    return (
      <li>
        <button
          onClick={() => toggle.mutate({ id: item.id, checked: !item.checked })}
          className="flex w-full items-center gap-3.5 px-4 py-4 text-right"
          aria-pressed={item.checked}
        >
          {check}
          <span className={cn("flex-1 text-base font-bold", item.checked && "text-muted-foreground line-through")}>
            {item.title}
          </span>
          {label && (
            <span className="rounded-lg bg-muted px-2 py-0.5 text-sm font-bold tabular-nums text-muted-foreground">
              {label}
            </span>
          )}
        </button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <button
        onClick={() => toggle.mutate({ id: item.id, checked: !item.checked })}
        aria-label={item.checked ? "בטל סימון" : "סמן"}
        className="-m-1.5 p-1.5"
      >
        {check}
      </button>
      <span className={cn("min-w-0 flex-1 truncate text-sm font-semibold", item.checked && "text-muted-foreground line-through")}>
        {item.title}
      </span>
      {!item.checked && (
        <div className="flex shrink-0 items-center rounded-xl bg-muted">
          <button
            onClick={() => updateQty.mutate({ id: item.id, quantity: Math.max(step, item.quantity - step) })}
            disabled={item.quantity <= step}
            className="flex size-7 items-center justify-center text-muted-foreground disabled:opacity-30"
            aria-label="הפחת"
          >
            <Minus className="size-3" />
          </button>
          <span className="min-w-[2.25rem] text-center text-xs font-bold tabular-nums">
            {label ?? "1"}
          </span>
          <button
            onClick={() => updateQty.mutate({ id: item.id, quantity: item.quantity + step })}
            className="flex size-7 items-center justify-center text-muted-foreground"
            aria-label="הוסף"
          >
            <Plus className="size-3" />
          </button>
        </div>
      )}
      <button
        onClick={() => del.mutate(item.id)}
        className="shrink-0 rounded-full p-1.5 text-muted-foreground/50 transition-colors duration-150 hover-fine:hover:text-destructive"
        aria-label="הסר"
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}

function AisleGroup({ cat, items, shopping }: { cat: CategoryKey; items: ShoppingItem[]; shopping: boolean }) {
  return (
    <section className="surface-card overflow-hidden rounded-3xl">
      <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-2.5">
        <CatIcon cat={cat} size="sm" />
        <span className="flex-1 text-xs font-bold text-muted-foreground">{CATEGORY_LABEL[cat]}</span>
        <span className="text-xs font-bold tabular-nums text-muted-foreground">{items.length}</span>
      </div>
      <ul className="divide-y divide-border/50">
        {items.map((i) => <ItemRow key={i.id} item={i} shopping={shopping} />)}
      </ul>
    </section>
  );
}


// ── Sharing ──────────────────────────────────────────────────────────────────

/** The code, big enough to read aloud across the kitchen. */
function CodeDisplay({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      /* clipboard blocked — the code is on screen to type by hand */
    }
  }

  async function share() {
    const text = `הצטרף לרשימת הקניות שלי ב"נהל הכל" עם הקוד ${code}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await copy();
    } catch {
      /* the user dismissed the share sheet */
    }
  }

  return (
    <div className="space-y-3">
      <div
        className="rounded-3xl bg-primary/8 py-5 text-center"
        // Enters from 0.96, never from nothing
        style={{ animation: `pop-code 200ms ${EASE} both` }}
      >
        <p className="font-display text-[2rem] font-extrabold tracking-[0.35em] text-primary">
          {code}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">הקוד לשיתוף</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={copy}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-muted py-3 text-sm font-bold transition-colors duration-150"
          style={{ transitionTimingFunction: EASE }}
        >
          {/* Transition, not keyframes: tapping copy twice retargets */}
          <span className="relative flex size-4 items-center justify-center">
            <Copy
              className="absolute size-4 transition-[opacity,transform] duration-150"
              style={{ transitionTimingFunction: EASE, opacity: copied ? 0 : 1, transform: copied ? "scale(0.9)" : "scale(1)" }}
            />
            <Check
              className="absolute size-4 text-success transition-[opacity,transform] duration-150"
              style={{ transitionTimingFunction: EASE, opacity: copied ? 1 : 0, transform: copied ? "scale(1)" : "scale(0.9)" }}
            />
          </span>
          {copied ? "הועתק" : "העתקה"}
        </button>
        <button
          onClick={share}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground"
        >
          <Share2 className="size-4" />
          שליחה
        </button>
      </div>
    </div>
  );
}


/** Who's in the list, and who's knocking. Owner-only actions. */
function PeopleList({ isOwner }: { isOwner: boolean }) {
  const { data: people = [] } = useHouseholdPeople(true);
  const approve = useApproveMember();
  const remove = useRemoveMember();
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmRemove) return;
    const t = setTimeout(() => setConfirmRemove(null), 3500);
    return () => clearTimeout(t);
  }, [confirmRemove]);

  const pending = people.filter((p) => p.status === "pending");
  const active = people.filter((p) => p.status === "active");

  return (
    <div className="space-y-4">
      {isOwner && pending.length > 0 && (
        <section>
          <p className="eyebrow mb-2 flex items-center gap-1.5">
            <Clock3 className="size-3.5 text-amber-500" />
            ממתינים לאישור
          </p>
          <ul className="space-y-2">
            {pending.map((p) => (
              <li
                key={p.userId}
                className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/8 p-3"
                style={{ animation: `fade-up 240ms ${EASE} both` }}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-sm font-bold text-amber-600">
                  {p.name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{p.name}</span>
                <button
                  onClick={() => remove.mutate(p.userId)}
                  className="rounded-xl bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground"
                >
                  דחייה
                </button>
                <button
                  onClick={() => approve.mutate(p.userId)}
                  className="flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                >
                  <UserCheck className="size-3.5" />
                  אישור
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <p className="eyebrow mb-2">ברשימה</p>
        <ul className="surface-card divide-y divide-border/50 overflow-hidden rounded-2xl">
          {active.map((p) => (
            <li key={p.userId} className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {p.name.charAt(0)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold">
                {p.name}
                {p.isMe && <span className="text-muted-foreground"> (אתה)</span>}
              </span>
              {p.isOwner ? (
                <span className="shrink-0 text-[11px] font-bold text-muted-foreground">בעל הרשימה</span>
              ) : isOwner ? (
                <button
                  onClick={() =>
                    confirmRemove === p.userId
                      ? remove.mutate(p.userId)
                      : setConfirmRemove(p.userId)
                  }
                  className="shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-bold transition-colors duration-200"
                  style={{
                    transitionTimingFunction: EASE,
                    backgroundColor:
                      confirmRemove === p.userId
                        ? "color-mix(in oklch, var(--destructive) 14%, transparent)"
                        : "transparent",
                    color:
                      confirmRemove === p.userId
                        ? "var(--destructive)"
                        : "var(--muted-foreground)",
                  }}
                >
                  {confirmRemove === p.userId ? "לחץ שוב" : "הסרה"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ShareSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: household } = useHousehold();
  const createHousehold = useCreateHousehold();
  const joinHousehold = useJoinHousehold();
  const leaveHousehold = useLeaveHousehold();

  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const waiting = household?.myStatus === "pending";
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    if (!confirmLeave) return;
    const t = setTimeout(() => setConfirmLeave(false), 3500);
    return () => clearTimeout(t);
  }, [confirmLeave]);

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    setError(null);
    try {
      const result = await joinHousehold.mutateAsync(code);
      if (result === "not_found") setError("קוד לא נמצא — בדוק שוב");
      else setJoinCode("");
    } catch {
      setError("ההצטרפות נכשלה — נסה שוב");
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-[30rem]">
        <DrawerHeader className="text-right">
          <DrawerTitle>רשימה משותפת</DrawerTitle>
          <DrawerDescription>
            {waiting
              ? "הבקשה נשלחה. הרשימה תיפתח ברגע שתאושר"
              : household
                ? "כל שינוי אצל אחד מכם מופיע מיד אצל השני"
                : "שתפו קוד אחד, ותראו את אותה רשימה"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-5 px-4 pb-8">
          {waiting ? (
            <>
              {/* Waiting on the owner — a calm hold state, not an error */}
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <span className="flex size-14 items-center justify-center rounded-3xl bg-amber-500/12 text-amber-600">
                  <Clock3 className="size-6" />
                </span>
                <p className="text-sm font-bold">ממתין לאישור</p>
                <p className="text-xs text-muted-foreground">
                  בעל הרשימה צריך לאשר אותך. זה יקרה כאן, בלי לרענן
                </p>
              </div>
              <button
                onClick={() => leaveHousehold.mutate()}
                className="w-full rounded-2xl bg-muted py-3 text-sm font-bold text-muted-foreground"
              >
                ביטול הבקשה
              </button>
            </>
          ) : household ? (
            <>
              <CodeDisplay code={household.code} />
              <PeopleList isOwner={household.isOwner} />
              <button
                onClick={() => (confirmLeave ? leaveHousehold.mutate() : setConfirmLeave(true))}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition-colors duration-200"
                style={{
                  transitionTimingFunction: EASE,
                  backgroundColor: confirmLeave
                    ? "color-mix(in oklch, var(--destructive) 14%, transparent)"
                    : "var(--muted)",
                  color: confirmLeave ? "var(--destructive)" : "var(--muted-foreground)",
                }}
              >
                <LogOut className="size-4" />
                {confirmLeave ? "לחץ שוב כדי לצאת" : household.isOwner ? "ביטול השיתוף" : "יציאה מהשיתוף"}
              </button>
              <p className="text-center text-[11px] text-muted-foreground">
                ביציאה הפריטים שהוספת חוזרים לרשימה הפרטית שלך
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => createHousehold.mutate()}
                disabled={createHousehold.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                <Users className="size-4" />
                {createHousehold.isPending ? "יוצר..." : "יצירת רשימה משותפת"}
              </button>

              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">או</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">קיבלת קוד?</p>
                <div className="flex gap-2">
                  <input
                    value={joinCode}
                    onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
                    placeholder="ABC123"
                    maxLength={8}
                    dir="ltr"
                    autoCapitalize="characters"
                    className="min-w-0 flex-1 rounded-2xl border border-border bg-card px-4 py-3 text-center text-lg font-bold tracking-[0.3em] outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    onClick={handleJoin}
                    disabled={joinCode.trim().length < 4 || joinHousehold.isPending}
                    className="shrink-0 rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground disabled:opacity-40"
                  >
                    {joinHousehold.isPending ? "..." : "הצטרפות"}
                  </button>
                </div>
                {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** The always-visible entry point at the top of the list. */
function ShareBar({ onOpen }: { onOpen: () => void }) {
  const { data: household } = useHousehold();
  const shared = !!household && household.memberCount > 1;
  const waiting = household?.myStatus === "pending";
  const requests = household?.isOwner ? (household.pendingCount ?? 0) : 0;

  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border/80 px-4 py-2.5 text-right transition-colors duration-150 hover-fine:hover:border-primary/40"
      style={{ transitionTimingFunction: EASE }}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          shared ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"
        )}
      >
        <Users className="size-4" />
      </span>
      <span className="flex-1 text-xs font-bold">
        {waiting
          ? "ממתין לאישור"
          : shared
            ? `רשימה משותפת · ${household.memberCount}`
            : "שתפו את הרשימה"}
      </span>
      {requests > 0 ? (
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600">
          {requests} ממתינים
        </span>
      ) : (
        <span className="text-[11px] font-semibold text-primary">
          {household ? "הקוד" : "שיתוף"}
        </span>
      )}
    </button>
  );
}

// ── Screen wake lock (shopping mode) ─────────────────────────────────────────
// Keeps the phone from dimming mid-aisle. Best-effort: unsupported browsers
// and denials are ignored.

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } })
      .wakeLock.request("screen")
      .then((l) => { if (cancelled) l.release(); else lock = l; })
      .catch(() => {});
    return () => { cancelled = true; lock?.release().catch(() => {}); };
  }, [active]);
}

// ── Page ─────────────────────────────────────────────────────────────────────

function ShoppingPage() {
  const { data: items = [], isLoading } = useShoppingItems();
  const clearChecked = useClearCheckedShoppingItems();
  const [shopping, setShopping] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { data: household } = useHousehold();
  // Live sync only matters once the list is actually shared
  useShoppingRealtime(!!household); // also fires while a request is pending
  useWakeLock(shopping);

  const open = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);
  const groups = groupByAisle(open);
  const total = items.length;
  const progress = total ? done.length / total : 0;
  const allDone = total > 0 && open.length === 0;

  function finishTrip() {
    clearChecked.mutate();
    setShopping(false);
    setCartOpen(false);
  }

  return (
    <AppShell
      title={shopping ? "בסופר" : "קניות"}
      subtitle={total > 0 ? (open.length ? `${open.length} פריטים לקנות` : "הכל בעגלה") : undefined}
      action={
        total > 0 ? (
          <button
            onClick={() => setShopping((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors duration-150",
              shopping ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
            )}
            style={{ transitionTimingFunction: EASE }}
          >
            {shopping ? <X className="size-3.5" /> : <ShoppingCart className="size-3.5" />}
            {shopping ? "סיום" : "מצב קנייה"}
          </button>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          <div className="h-16 rounded-3xl bg-muted" />
          <div className="h-40 rounded-3xl bg-muted" />
        </div>
      ) : (
        <div className="space-y-4 pb-28">
          {!shopping && <QuickAdd items={items} />}
          {!shopping && <ShareBar onOpen={() => setShareOpen(true)} />}

          {/* Progress — transform only, grows from the right (RTL) */}
          {total > 0 && (
            <div className={cn("space-y-1.5", shopping && "sticky top-[5.5rem] z-10 -mx-5 bg-background/90 px-5 py-2 backdrop-blur")}>
              <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                <span>{done.length} מתוך {total} בעגלה</span>
                <span className="tabular-nums">{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full origin-right rounded-full bg-primary transition-transform duration-300"
                  style={{ transform: `scaleX(${progress})`, transitionTimingFunction: EASE }}
                />
              </div>
            </div>
          )}

          {allDone && (
            <div className="surface-card flex items-center gap-3 rounded-3xl p-4" style={{ animation: `fade-up 280ms ${EASE} both` }}>
              <span className="flex size-10 items-center justify-center rounded-2xl bg-success/12 text-success">
                <PartyPopper className="size-5" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold">הכל בעגלה</p>
                <p className="text-xs text-muted-foreground">אפשר לנקות את הרשימה לפעם הבאה</p>
              </div>
              <button onClick={finishTrip} className="rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground">
                נקה
              </button>
            </div>
          )}

          {groups.length > 0 && (
            <div className="space-y-3 stagger-list">
              {groups.map((g) => <AisleGroup key={g.cat} cat={g.cat} items={g.items} shopping={shopping} />)}
            </div>
          )}

          {!shopping && <Staples items={items} />}

          {total === 0 && (
            <div className="flex flex-col items-center py-12 text-center">
              <span className="mb-4 flex size-16 items-center justify-center rounded-3xl bg-primary/8 text-primary">
                <ShoppingCart className="size-7" />
              </span>
              <p className="text-base font-bold">הרשימה ריקה</p>
              <p className="mt-1 text-sm text-muted-foreground">הקלד למעלה, או בחר מההצעות</p>
            </div>
          )}

          {/* In the cart — collapsed in shopping mode so it doesn't crowd the aisle list */}
          {done.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <button onClick={() => setCartOpen((v) => !v)} className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  בעגלה ({done.length})
                  <ChevronDown className={cn("size-3.5 transition-transform duration-150", !(cartOpen || !shopping) && "-rotate-90")} />
                </button>
                {!allDone && (
                  <button
                    onClick={() => clearChecked.mutate()}
                    disabled={clearChecked.isPending}
                    className="text-xs font-semibold text-destructive disabled:opacity-50"
                  >
                    נקה
                  </button>
                )}
              </div>
              {(cartOpen || !shopping) && (
                <ul className="surface-card divide-y divide-border/50 overflow-hidden rounded-3xl opacity-70">
                  {done.map((i) => <ItemRow key={i.id} item={i} shopping={shopping} />)}
                </ul>
              )}
            </section>
          )}

          {shopping && done.length > 0 && !allDone && (
            <button
              onClick={finishTrip}
              className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground"
            >
              סיימתי קנייה — נקה את מה שבעגלה
            </button>
          )}
        </div>
      )}

      <ShareSheet open={shareOpen} onOpenChange={setShareOpen} />
    </AppShell>
  );
}
