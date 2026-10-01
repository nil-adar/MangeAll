import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  Camera, Check, Pencil, X, LogOut, Mail, Wallet, User, Trash2,
  KeyRound, Lightbulb, Cake, PartyPopper, ShoppingCart, ListChecks, CalendarDays, AlertTriangle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useOccasions } from "@/components/OccasionList";
import { resetTips } from "@/components/Tip";
import { supabase } from "@/lib/supabase";
import {
  useProfile,
  useSetDisplayName,
  useUploadAvatar,
  useRemoveAvatar,
  useMonthlyBudget,
  useSetMonthlyBudget,
  useTasks,
  useEvents,
  useShoppingItems,
} from "@/lib/queries";
import { shekel, DEFAULT_MONTHLY_BUDGET } from "@/lib/config";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB

function ProfilePage() {
  const navigate = useNavigate();

  const { data: profile, isLoading } = useProfile();
  const { data: monthlyBudget = DEFAULT_MONTHLY_BUDGET } = useMonthlyBudget();
  const { data: tasks = [] } = useTasks();
  const { data: events = [] } = useEvents();
  const { data: shopping = [] } = useShoppingItems();

  const setDisplayName = useSetDisplayName();
  const setBudget = useSetMonthlyBudget();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();

  const fileInput = useRef<HTMLInputElement>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pwSent, setPwSent] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Transient confirmations. Boolean + CSS transition, never keyframes: these
  // can fire twice in a second and a transition retargets from where it is.
  const [savedKey, setSavedKey] = useState<string | null>(null);
  useEffect(() => {
    if (!savedKey) return;
    const t = setTimeout(() => setSavedKey(null), 1600);
    return () => clearTimeout(t);
  }, [savedKey]);

  // Arming a destructive action should time out rather than stay armed.
  useEffect(() => {
    if (!confirmRemove) return;
    const t = setTimeout(() => setConfirmRemove(false), 3500);
    return () => clearTimeout(t);
  }, [confirmRemove]);

  const displayName = profile?.display_name ?? "";
  const email = profile?.email ?? "";
  const avatarUrl = profile?.avatar_url ?? null;
  const settingsReady = profile?.settingsReady ?? true;
  const initial = (displayName || email || "?").charAt(0).toUpperCase();

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("he-IL", {
        month: "long",
        year: "numeric",
      })
    : null;

  // Stats — all from data already loaded elsewhere in the app.
  const openTasks = tasks.filter((t) => !t.done).length;
  const birthdayCount = events.filter((e) => e.is_birthday).length;
  const eventCount = events.filter((e) => !e.is_birthday).length;
  const shoppingOpen = shopping.filter((i) => !i.checked).length;
  const { occasions } = useOccasions();
  const [tipsReset, setTipsReset] = useState(false);

  function startEditName() {
    setNameDraft(displayName);
    setEditingName(true);
  }

  function saveName() {
    const val = nameDraft.trim();
    if (val && val !== displayName) {
      setDisplayName.mutate(val);
      setSavedKey("name");
    }
    setEditingName(false);
  }

  function startEditBudget() {
    setBudgetDraft(String(monthlyBudget));
    setEditingBudget(true);
  }

  function saveBudget() {
    const val = parseInt(budgetDraft.replace(/\D/g, ""), 10);
    if (val > 0 && val !== monthlyBudget) {
      setBudget.mutate(val);
      setSavedKey("budget");
    }
    setEditingBudget(false);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;

    setUploadError(null);
    if (!file.type.startsWith("image/")) {
      setUploadError("אפשר להעלות תמונות בלבד");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setUploadError("התמונה גדולה מדי — עד 5MB");
      return;
    }
    uploadAvatar.mutate(file, {
      onSuccess: () => setSavedKey("avatar"),
      onError: () =>
        setUploadError(
          settingsReady
            ? "ההעלאה נכשלה — נסה שוב"
            : "צריך להריץ את profile-setup.sql ב-Supabase"
        ),
    });
  }

  function handleRemovePhoto() {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setConfirmRemove(false);
    removeAvatar.mutate();
  }

  async function handleChangePassword() {
    if (!email) return;
    setPwError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setPwError(error.message);
    else setPwSent(true);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  if (isLoading) {
    return (
      <AppShell title="פרופיל">
        <div className="space-y-4">
          <div className="h-32 rounded-3xl bg-muted" />
          <div className="h-24 rounded-3xl bg-muted" />
          <div className="h-20 rounded-3xl bg-muted" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="פרופיל">
      <div className="space-y-4 stagger-list">

        {/* ── Migration notice ── only while the columns are missing ── */}
        {!settingsReady && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-bold text-amber-700">חסרה הגדרה במסד הנתונים</p>
              <p className="mt-0.5 text-xs text-amber-700/80">
                הרץ את profile-setup.sql ב-Supabase כדי לאפשר שם תצוגה ותמונת פרופיל
              </p>
            </div>
          </div>
        )}

        {/* ── Identity ── avatar right, name/email left (RTL) ── */}
        <section className="surface-card rounded-3xl p-5">
          <div className="flex items-center gap-4">

            <div className="relative shrink-0">
              <button
                onClick={() => fileInput.current?.click()}
                disabled={uploadAvatar.isPending}
                aria-label="החלפת תמונת פרופיל"
                className="group relative block size-20 overflow-hidden rounded-full bg-primary"
              >
                <span className="absolute inset-0 flex items-center justify-center font-display text-2xl font-bold text-primary-foreground">
                  {initial}
                </span>

                {/* Photo crossfades over the initial once decoded — never teleports in */}
                {avatarUrl && <AvatarImage key={avatarUrl} src={avatarUrl} />}

                {/* Dim while uploading. Transition, so re-picking retargets. */}
                <span
                  className="absolute inset-0 bg-foreground/45 transition-opacity duration-200"
                  style={{
                    transitionTimingFunction: "var(--ease-out)",
                    opacity: uploadAvatar.isPending ? 1 : 0,
                  }}
                />

                {/* CSS animation, not rAF: stays smooth while the upload
                    saturates the main thread. */}
                {uploadAvatar.isPending && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="size-7 animate-spin rounded-full border-[3px] border-primary-foreground/35 border-t-primary-foreground" />
                  </span>
                )}

                {/* Hover affordance — gated: touch fires a false hover on tap */}
                <span
                  className="absolute inset-0 hidden items-center justify-center bg-foreground/40 opacity-0 transition-opacity duration-150 hover-fine:flex hover-fine:group-hover:opacity-100"
                  style={{ transitionTimingFunction: "var(--ease-out)" }}
                >
                  <Camera className="size-5 text-primary-foreground" />
                </span>
              </button>

              <span className="pointer-events-none absolute -bottom-0.5 -left-0.5 flex size-7 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground">
                <Camera className="size-3.5" />
              </span>

              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                onChange={handleFile}
                className="hidden"
              />
            </div>

            <div className="min-w-0 flex-1">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveName();
                      if (e.key === "Escape") setEditingName(false);
                    }}
                    placeholder="השם שלך"
                    autoFocus
                    maxLength={40}
                    className="min-w-0 flex-1 border-b-2 border-primary bg-transparent pb-1 text-lg font-bold outline-none"
                  />
                  <button onClick={saveName} aria-label="שמור" className="rounded-xl bg-primary p-2 text-primary-foreground">
                    <Check className="size-4" />
                  </button>
                  <button onClick={() => setEditingName(false)} aria-label="ביטול" className="rounded-xl bg-muted p-2">
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={startEditName} className="flex min-w-0 flex-1 items-center gap-2 text-right">
                    <span className="truncate text-lg font-bold">
                      {displayName || "הוסף שם"}
                    </span>
                    <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                  <SavedTick show={savedKey === "name" || savedKey === "avatar"} />
                </div>
              )}

              <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <Mail className="size-3 shrink-0" />
                {email || "—"}
              </p>
              {memberSince && (
                <p className="mt-0.5 text-xs text-muted-foreground">חבר מאז {memberSince}</p>
              )}
            </div>
          </div>

          {uploadError && (
            <p className="mt-3 text-xs font-semibold text-destructive">{uploadError}</p>
          )}

          {avatarUrl && (
            <button
              onClick={handleRemovePhoto}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-bold transition-colors duration-200"
              style={{
                transitionTimingFunction: "var(--ease-out)",
                backgroundColor: confirmRemove
                  ? "color-mix(in oklch, var(--destructive) 14%, transparent)"
                  : "var(--muted)",
                color: confirmRemove ? "var(--destructive)" : "var(--muted-foreground)",
              }}
            >
              <Trash2 className="size-3.5" />
              {confirmRemove ? "לחץ שוב כדי להסיר" : "הסרת התמונה"}
            </button>
          )}
        </section>

        {/* ── Stats ── 2x2 grid (never 3 equal cards) ── */}
        <section className="surface-card rounded-3xl p-5">
          <p className="eyebrow mb-3">במספרים</p>
          <div className="grid grid-cols-2 gap-3 stagger-list">
            <Stat icon={ListChecks} value={openTasks} label="משימות פתוחות" />
            <Stat icon={CalendarDays} value={eventCount} label="אירועים" />
            <Stat icon={Cake} value={birthdayCount} label="ימי הולדת" />
            <Stat icon={ShoppingCart} value={shoppingOpen} label="פריטים ברשימה" />
          </div>
        </section>

        {/* ── Monthly budget ── */}
        <section className="surface-card rounded-3xl p-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow flex items-center gap-1.5">
              <Wallet className="size-3.5" />
              תקציב חודשי
            </p>
            <SavedTick show={savedKey === "budget"} />
          </div>

          {editingBudget ? (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-muted-foreground">₪</span>
              <input
                type="number"
                dir="ltr"
                value={budgetDraft}
                onChange={(e) => setBudgetDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveBudget();
                  if (e.key === "Escape") setEditingBudget(false);
                }}
                autoFocus
                className="min-w-0 flex-1 border-b-2 border-primary bg-transparent text-2xl font-bold tabular-nums outline-none"
              />
              <button onClick={saveBudget} aria-label="שמור" className="rounded-xl bg-primary p-2 text-primary-foreground">
                <Check className="size-4" />
              </button>
              <button onClick={() => setEditingBudget(false)} aria-label="ביטול" className="rounded-xl bg-muted p-2">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button onClick={startEditBudget} className="flex w-full items-center gap-2 text-right">
              <span className="text-2xl font-bold tabular-nums">{shekel(monthlyBudget)}</span>
              <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            משמש לחישוב ההתקדמות בעמוד הכספים
          </p>
        </section>

        {/* ── Quick links ── surfaces the pages with no tab of their own ── */}
        <section className="surface-card rounded-3xl p-5">
          <p className="eyebrow mb-3">קיצורי דרך</p>
          <div className="space-y-2">
            <QuickLink to="/birthdays" icon={Cake} label="ימי הולדת" count={birthdayCount} />
            <QuickLink to="/occasions" icon={PartyPopper} label="שמחות" count={occasions.length} />
            <QuickLink to="/shopping" icon={ShoppingCart} label="רשימת קניות" count={shoppingOpen} />
          </div>
        </section>

        {/* ── Account ── */}
        <section className="surface-card rounded-3xl p-5">
          <p className="eyebrow mb-3 flex items-center gap-1.5">
            <User className="size-3.5" />
            חשבון
          </p>

          <button
            onClick={handleChangePassword}
            disabled={pwSent || !email}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-muted py-3 text-sm font-bold transition-colors duration-150 disabled:opacity-60 hover-fine:hover:bg-border/60"
            style={{ transitionTimingFunction: "var(--ease-out)" }}
          >
            <KeyRound className="size-4" />
            {pwSent ? "נשלח קישור לאימייל" : "שינוי סיסמה"}
          </button>
          {pwSent && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              בדוק את תיבת הדואר שלך
            </p>
          )}
          {pwError && (
            <p className="mt-2 text-center text-xs font-semibold text-destructive">{pwError}</p>
          )}

          {/* The one-time tips (components/Tip.tsx), for anyone who closed one too fast */}
          <button
            onClick={() => {
              resetTips();
              setTipsReset(true);
            }}
            disabled={tipsReset}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-muted py-3 text-sm font-bold transition-colors duration-150 disabled:opacity-60 hover-fine:hover:bg-border/60"
            style={{ transitionTimingFunction: "var(--ease-out)" }}
          >
            <Lightbulb className="size-4" />
            {tipsReset ? "הטיפים יופיעו שוב" : "הצגת הטיפים מחדש"}
          </button>

          <button
            onClick={handleLogout}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive/10 py-3 text-sm font-bold text-destructive transition-colors duration-150 hover-fine:hover:bg-destructive/15"
            style={{ transitionTimingFunction: "var(--ease-out)" }}
          >
            <LogOut className="size-4" />
            התנתק
          </button>
        </section>

      </div>
    </AppShell>
  );
}

/** Static on purpose — four numbers counting up at once is noise, not feedback. */
function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof ListChecks;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-2xl bg-muted/60 p-3.5">
      <Icon className="size-4 text-primary" />
      <p className="mt-2 text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
  count,
}: {
  to: string;
  icon: typeof Cake;
  label: string;
  count: number;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3.5 transition-colors duration-150 hover-fine:hover:bg-muted"
      style={{ transitionTimingFunction: "var(--ease-out)" }}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-4" />
      </span>
      <span className="flex-1 text-sm font-bold">{label}</span>
      <span className="text-sm font-bold tabular-nums text-muted-foreground">{count}</span>
    </Link>
  );
}

/**
 * Crossfades the photo over the initial-letter fallback once decoded.
 * Opacity only — no layout, no paint, GPU.
 */
function AvatarImage({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={src}
      alt=""
      onLoad={() => setLoaded(true)}
      className="absolute inset-0 size-full object-cover transition-opacity duration-200"
      style={{
        transitionTimingFunction: "var(--ease-out)",
        opacity: loaded ? 1 : 0,
      }}
    />
  );
}

/**
 * Transition-driven (not keyframes) so a second save while the first tick is
 * still fading retargets from where it is. Enters at scale(0.9), never 0.
 */
function SavedTick({ show }: { show: boolean }) {
  return (
    <span
      aria-live="polite"
      className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-success transition-[opacity,transform] duration-200"
      style={{
        transitionTimingFunction: "var(--ease-out)",
        opacity: show ? 1 : 0,
        transform: show ? "scale(1)" : "scale(0.9)",
      }}
    >
      <Check className="size-3.5" />
      נשמר
    </span>
  );
}
