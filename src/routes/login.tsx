import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowDown, ArrowLeft, Mail, Lock, Eye, EyeOff, Check, CircleCheckBig, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { rememberInvite, takePendingInvite } from "@/lib/pending-invite";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string; verified?: boolean } => {
    const r = search["redirect"];
    // Only same-app paths. "//evil.com" and "https://…" are rejected, so a
    // crafted link can't bounce someone off-site after they sign in.
    const out: { redirect?: string; verified?: boolean } = {};
    if (typeof r === "string" && /^\/(?!\/)/.test(r)) out.redirect = r;
    // Set by the signup confirmation email link (see emailRedirectTo below).
    if (search["verified"] === 1 || search["verified"] === "1") out.verified = true;
    return out;
  },
  component: LoginPage,
});

const EASE = "var(--ease-out)";

/** Screenshots in public/screens/, 600×1298, taken from the demo account. */
const TOUR = [
  {
    src: "/screens/home.jpg",
    alt: "מסך הבית: שאלת ימי העבודה, הפגישה הבאה וימי הולדת קרובים",
    title: "כל היום במבט אחד",
    text: "הפגישה הבאה, המשימות להיום ומי חוגג בקרוב.",
  },
  {
    src: "/screens/calendar.jpg",
    alt: "לוח שנה חודשי עם האירועים של היום",
    title: "יומן ומשימות",
    text: "לוח שנה ורשימת משימות באותה לשונית, עם סינון למשפחה ולעבודה.",
  },
  {
    src: "/screens/shopping.jpg",
    alt: "רשימת קניות מחולקת למחלקות בסופר",
    title: "קניות שמסתדרות לבד",
    text: "כותבים ״3 חלב״, והפריט נכנס עם הכמות למחלקה הנכונה.",
  },
  {
    src: "/screens/finance.jpg",
    alt: "כספים: הוצאות החודש מול התקציב",
    title: "יודעים כמה נשאר",
    text: "הוצאות מזדמנות וקבועות מול תקציב חודשי שקובעים לבד.",
  },
  {
    src: "/screens/workday.jpg",
    alt: "יומן ימי עבודה עם סיכום חודשי",
    title: "ימי עבודה",
    text: "שאלה אחת ביום, וסיכום חודשי שאפשר להדפיס.",
  },
  {
    src: "/screens/quickadd.jpg",
    alt: "תפריט הוספה מהירה מחולק ליומן, כסף ועוד",
    title: "הכול מה־+ שבאמצע",
    text: "משימה, אירוע, הוצאה או פריט לקניות, מכל מסך.",
  },
] as const;

/** Smooth scrolling, unless the visitor asked the system for less motion. */
function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/**
 * "Remember me", implemented rather than decorative: unchecked marks the
 * session as this-session-only, and AuthGuard signs out when the browser is
 * reopened. See SESSION_ONLY_KEY in routes/__root.tsx.
 */
const SESSION_ONLY_KEY = "nahel-hakol:session-only";

/**
 * Set once anyone has signed in (or signed up) from this device — here and in
 * AuthGuard (routes/__root.tsx). The page opens on login for them and on
 * sign-up for a first-time visitor, who would otherwise land on "טוב לראות
 * אותך שוב" with no account to log into.
 */
const KNOWN_DEVICE_KEY = "nahel-hakol:has-account";

function isKnownDevice(): boolean {
  try {
    return localStorage.getItem(KNOWN_DEVICE_KEY) === "1";
  } catch {
    return false;
  }
}

function markKnownDevice() {
  try {
    localStorage.setItem(KNOWN_DEVICE_KEY, "1");
  } catch {
    /* storage blocked — next visit simply opens on sign-up again */
  }
}

function LoginPage() {
  const navigate = useNavigate();
  const { redirect, verified } = Route.useSearch();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [isRegister, setIsRegister] = useState(() => !verified && !isKnownDevice());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Wrong email/password. Supabase won't say whether the email is registered
  // (on purpose), so the message offers both ways forward instead of guessing.
  const [loginFailed, setLoginFailed] = useState(false);

  // Back to the page they asked for, or home. A full load rather than a
  // client-side navigate: the saved path can carry its own query string
  // ("/expense/new?mode=fixed"), which `navigate({ to })` does not parse.
  const goOn = () => {
    const target = takePendingInvite() ?? redirect;
    if (target) window.location.replace(target);
    else navigate({ to: "/" });
  };

  // Arrived from an invite link: keep it for after sign-up (see rememberInvite)
  useEffect(() => {
    rememberInvite(redirect);
  }, [redirect]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (verified) {
        markKnownDevice();
        // Arrived from the confirmation email. Supabase has already signed
        // them in from the link's token; sign that session out so they log in
        // themselves, with the email filled in. No session means the link was
        // expired or already used — by then the account is usually confirmed.
        if (data.session) {
          setEmail(data.session.user.email ?? "");
          await supabase.auth.signOut();
          setMessage("החשבון אומת בהצלחה — עכשיו אפשר להתחבר");
        } else {
          setError("הקישור כבר נוצל או שפג תוקפו — נסה להתחבר");
        }
        window.history.replaceState(null, "", "/login");
        return;
      }
      if (data.session) {
        markKnownDevice();
        goOn();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  function rememberChoice() {
    try {
      if (remember) localStorage.removeItem(SESSION_ONLY_KEY);
      else localStorage.setItem(SESSION_ONLY_KEY, "1");
    } catch {
      /* storage blocked — the session simply stays signed in */
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoginFailed(false);

    // The form has noValidate (so our own Hebrew messages show instead of
    // the browser's native ones) — so `required` on the fields no longer
    // blocks submission on its own; check it here instead.
    if (!email.trim() || !password) {
      setError("נא למלא אימייל וסיסמה");
      return;
    }

    setLoading(true);
    rememberChoice();

    if (isRegister) {
      if (!name.trim()) {
        setError("נא להזין שם מלא");
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError("הסיסמה חייבת להכיל לפחות 6 תווים");
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError("הסיסמאות אינן תואמות");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login?verified=1`,
          // Stored on the auth user immediately (no session/RLS needed yet,
          // unlike user_settings). useProfile() falls back to this until
          // the user (or a future edit) writes it into user_settings.
          data: { display_name: name.trim() },
        },
      });
      // Supabase doesn't return an error for an email that's already
      // registered (to avoid leaking which emails exist) — it returns a
      // user object with an empty `identities` array instead. That's the
      // documented way to detect this case client-side.
      if (error) setError(error.message);
      else if (data.user && data.user.identities?.length === 0) {
        setError("משתמש עם אימייל זה כבר רשום — נסה להתחבר");
      } else {
        markKnownDevice();
        setMessage("נשלח אימייל אישור — בדוק את תיבת הדואר שלך");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      // An unconfirmed account is not a wrong password — saying so sends
      // people to "forgot password" instead of their inbox.
      if (error?.code === "email_not_confirmed")
        setError("צריך לאשר את האימייל קודם — חפש את מייל האימות בתיבת הדואר (וגם בספאם)");
      else if (error?.code === "over_request_rate_limit")
        setError("יותר מדי ניסיונות — נסה שוב בעוד כמה דקות");
      else if (error?.code === "invalid_credentials") setLoginFailed(true);
      else if (error) setError("אימייל או סיסמה שגויים");
      else {
        markKnownDevice();
        goOn();
      }
    }
    setLoading(false);
  }

  async function handleGoogle() {
    setError(null);
    rememberChoice();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + (redirect ?? "/") },
    });
    if (error) setError("ההתחברות עם Google נכשלה — נסה שוב");
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("הכנס אימייל ואז לחץ שוב על 'שכחתי סיסמה'");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    setLoginFailed(false);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setError(error.message);
    else setMessage("נשלח קישור לאיפוס סיסמה — בדוק את תיבת הדואר שלך");
    setLoading(false);
  }

  function switchMode(register: boolean) {
    setIsRegister(register);
    setError(null);
    setMessage(null);
    setLoginFailed(false);
  }

  // The tour's call to action: back up to the form, ready to sign up.
  function startSignUp() {
    switchMode(true);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }

  return (
    <div dir="rtl" className="bg-background">
      {/* First screen: the form, centred. The tour sits below the fold. */}
      <div className="relative flex min-h-svh flex-col justify-center overflow-hidden px-5 py-10">
        {/* Ambient wash. Decorative only, behind everything, never interactive. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="login-glow login-glow-a" />
          <span className="login-glow login-glow-b" />
        </div>

        <div className="relative mx-auto w-full max-w-sm">

          {/* ── Brand ── centred and large: the mark is the page's one anchor ── */}
          <div
            className="flex flex-col items-center text-center"
            style={{ animation: `fade-up 320ms ${EASE} both` }}
          >
            <span className="relative flex size-20 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-float)]">
              {/* 1px inner highlight — reads as a lit edge rather than a flat disc */}
              <span aria-hidden="true" className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/20" />
              <CircleCheckBig className="size-10" strokeWidth={2.2} />
            </span>
            <p className="mt-4 font-display text-2xl font-extrabold leading-none">נהל הכל</p>
            <p className="mt-2 text-sm text-muted-foreground">כל מה שהיום צריך, באפליקציה אחת</p>
            <button
              type="button"
              onClick={() => document.getElementById("tour")?.scrollIntoView({ behavior: scrollBehavior() })}
              className="group mt-3 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-muted-foreground transition-colors duration-150 hover-fine:hover:text-primary"
              style={{ transitionTimingFunction: EASE }}
            >
              ככה זה נראה
              <ArrowDown
                className="size-3.5 transition-transform duration-150 hover-fine:group-hover:translate-y-0.5"
                style={{ transitionTimingFunction: EASE }}
              />
            </button>
          </div>

          {/* ── Title ── centred under the mark so the header reads as one block ── */}
          <div className="mt-8 text-center" style={{ animation: `fade-up 320ms ${EASE} 70ms both` }}>
            <h1 className="font-display text-[2rem] font-extrabold leading-tight tracking-tight">
              {isRegister ? "יצירת חשבון חדש" : "כניסה לחשבון"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isRegister ? "כמה פרטים והכול מוכן." : "טוב לראות אותך שוב."}
            </p>
          </div>

          {/* ── Mode ── the indicator slides, so the state change is legible ── */}
          <div
            className="relative mt-6 flex rounded-2xl bg-muted p-1"
            style={{ animation: `fade-up 320ms ${EASE} 140ms both` }}
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-xl bg-card shadow-sm transition-transform duration-200"
              style={{
                insetInlineStart: "0.25rem",
                transitionTimingFunction: EASE,
                // The indicator sits over the leading (right, in RTL) half and
                // slides left for the second tab. translateX ignores direction,
                // so -100% is always "one slot to the left" on screen.
                transform: isRegister ? "translateX(-100%)" : "translateX(0)",
              }}
            />
            {[
              { register: false, label: "כניסה" },
              { register: true, label: "חשבון חדש" },
            ].map(({ register, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => switchMode(register)}
                aria-pressed={isRegister === register}
                className={cn(
                  "relative z-10 flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors duration-200",
                  isRegister === register
                    ? "text-foreground"
                    : "text-muted-foreground hover-fine:hover:text-foreground"
                )}
                style={{ transitionTimingFunction: EASE }}
              >
                {label}
              </button>
            ))}
          </div>

          <form
            onSubmit={handleEmailAuth}
            noValidate
            style={{ animation: `fade-up 320ms ${EASE} 200ms both` }}
          >
            {/* ── Fields ── one card, rows divided by a hairline ── */}
            <div className="mt-5 overflow-hidden rounded-3xl border border-border bg-card">
              {/* Email first in both modes: switching between them keeps the
                  field everyone fills in the same place. */}
              <Field
                id="email"
                label="אימייל"
                icon={Mail}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={setEmail}
                required
              />
              <div className="h-px bg-border" />
              {isRegister && (
                <>
                  <Field
                    id="name"
                    label="שם מלא"
                    icon={User}
                    type="text"
                    autoComplete="name"
                    placeholder="ישראל ישראלי"
                    value={name}
                    onChange={setName}
                    required
                  />
                  <div className="h-px bg-border" />
                </>
              )}
              <Field
                id="password"
                label="סיסמה"
                icon={Lock}
                type={showPassword ? "text" : "password"}
                autoComplete={isRegister ? "new-password" : "current-password"}
                placeholder={isRegister ? "לפחות 6 תווים" : "••••••••"}
                value={password}
                onChange={setPassword}
                required
                minLength={isRegister ? 6 : undefined}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
                    className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors duration-150 hover-fine:hover:bg-muted hover-fine:hover:text-foreground"
                    style={{ transitionTimingFunction: EASE }}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                }
              />
              {isRegister && (
                <>
                  <div className="h-px bg-border" />
                  <Field
                    id="confirm-password"
                    label="אימות סיסמה"
                    icon={Lock}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="הקלד/י שוב את הסיסמה"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    required
                  />
                </>
              )}
            </div>

            {/* ── Remember + forgot ── */}
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setRemember((v) => !v)}
                aria-pressed={remember}
                className="group flex items-center gap-2 text-sm font-semibold"
              >
                לזכור אותי
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-md border-2 transition-[background-color,border-color] duration-150",
                    remember
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover-fine:group-hover:border-primary/50"
                  )}
                  style={{ transitionTimingFunction: EASE }}
                >
                  <Check
                    className="size-3 transition-[opacity,transform] duration-150"
                    strokeWidth={3}
                    style={{
                      transitionTimingFunction: EASE,
                      opacity: remember ? 1 : 0,
                      transform: remember ? "scale(1)" : "scale(0.9)",
                    }}
                  />
                </span>
              </button>

              {!isRegister && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-xs font-semibold text-muted-foreground transition-colors duration-150 disabled:opacity-40 hover-fine:hover:text-primary"
                  style={{ transitionTimingFunction: EASE }}
                >
                  שכחתי סיסמה
                </button>
              )}
            </div>

            {error && (
              <p className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive" role="alert">
                {error}
              </p>
            )}
            {loginFailed && (
              <div className="mt-4 rounded-2xl bg-destructive/10 px-3.5 py-3 text-destructive" role="alert">
                <p className="text-xs font-bold">לא הצלחנו להיכנס עם הפרטים האלה</p>
                <p className="mt-0.5 text-xs">אולי עוד לא נרשמת, או שהסיסמה שגויה.</p>
                {/* Both keep the email that's already typed in */}
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => switchMode(true)}
                    className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground transition-transform duration-150 active:scale-[0.97]"
                    style={{ transitionTimingFunction: EASE }}
                  >
                    להרשמה
                  </button>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={loading}
                    className="flex-1 rounded-xl bg-card py-2 text-xs font-bold text-foreground transition-transform duration-150 active:scale-[0.97] disabled:opacity-50"
                    style={{ transitionTimingFunction: EASE }}
                  >
                    איפוס סיסמה
                  </button>
                </div>
              </div>
            )}
            {message && (
              <p className="mt-4 rounded-xl bg-success/10 px-3 py-2 text-xs font-semibold text-success" role="status">
                {message}
              </p>
            )}

            {/* ── Submit ── the arrow travels on hover, hinting at "forward" ── */}
            <button
              type="submit"
              disabled={loading}
              className="group mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] transition-[transform,opacity] duration-150 disabled:opacity-50 hover-fine:hover:-translate-y-px"
              style={{ transitionTimingFunction: EASE }}
            >
              {loading ? "רגע..." : isRegister ? "יצירת חשבון" : "כניסה"}
              <ArrowLeft
                className="size-4 transition-transform duration-150 hover-fine:group-hover:-translate-x-1"
                style={{ transitionTimingFunction: EASE }}
              />
            </button>
          </form>

          {/* ── Switch mode ── the page opens on login, so a first-time visitor
              needs an obvious way across to sign-up right under the button. */}
          <button
            type="button"
            onClick={() => switchMode(!isRegister)}
            className="group mx-auto mt-4 flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover-fine:hover:bg-muted"
            style={{ transitionTimingFunction: EASE }}
          >
            {isRegister ? "כבר יש לך חשבון?" : "עוד אין לך חשבון?"}
            <span className="font-bold text-primary">{isRegister ? "כניסה" : "להרשמה, לוקח דקה"}</span>
            <ArrowLeft
              className="size-4 text-primary transition-transform duration-150 hover-fine:group-hover:-translate-x-1"
              style={{ transitionTimingFunction: EASE }}
            />
          </button>

          {/* ── Google ── */}
          <div className="mt-5" style={{ animation: `fade-up 320ms ${EASE} 260ms both` }}>
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">או</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <button
              onClick={handleGoogle}
              className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card py-3.5 text-sm font-bold transition-[transform,border-color,background-color] duration-150 hover-fine:hover:-translate-y-px hover-fine:hover:border-primary/30 hover-fine:hover:bg-muted"
              style={{ transitionTimingFunction: EASE }}
            >
              <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              המשך עם Google
            </button>
          </div>

          <p
            className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground"
            style={{ animation: `fade-up 320ms ${EASE} 320ms both` }}
          >
            הנתונים שלך נשמרים בחשבון פרטי, ורק אתה רואה אותם.
          </p>
        </div>
      </div>

      <AppTour onStart={startSignUp} />
    </div>
  );
}

/**
 * Real screenshots (demo account, sample data) under the form. A first-time
 * visitor lands here before anything else, so this is where they get to see
 * the app before signing up. Swipes sideways on a phone, a grid when wider.
 */
function AppTour({ onStart }: { onStart: () => void }) {
  return (
    <section id="tour" aria-labelledby="tour-title" className="scroll-mt-4 border-t border-border px-5 py-14">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 id="tour-title" className="font-display text-[1.75rem] font-extrabold leading-tight tracking-tight">
            ככה זה נראה
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">צילומי מסך מהאפליקציה, מחשבון דמו עם נתונים לדוגמה.</p>
        </div>

        <ul className="-mx-5 mt-8 flex snap-x snap-mandatory scroll-px-5 gap-5 overflow-x-auto px-5 pb-4 md:mx-0 md:grid md:grid-cols-3 md:gap-x-10 md:gap-y-12 md:overflow-visible md:px-0 md:pb-0">
          {TOUR.map((shot) => (
            <li key={shot.src} className="w-[64vw] max-w-60 shrink-0 snap-start md:w-auto md:max-w-none">
              <div
                className="rounded-[2.2rem] p-1.5 shadow-[0_24px_48px_-24px_oklch(0.25_0.05_255/55%)]"
                style={{ background: "linear-gradient(145deg, #2B3A52, #0B121E 60%)" }}
              >
                <img
                  src={shot.src}
                  alt={shot.alt}
                  width={600}
                  height={1298}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full rounded-[1.85rem]"
                />
              </div>
              <h3 className="mt-4 font-display text-base font-extrabold">{shot.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{shot.text}</p>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={onStart}
            className="group flex items-center gap-2 rounded-2xl bg-primary px-7 py-4 text-sm font-bold text-primary-foreground shadow-[var(--shadow-float)] transition-transform duration-150 hover-fine:hover:-translate-y-px"
            style={{ transitionTimingFunction: EASE }}
          >
            מתחילים בחינם
            <ArrowLeft
              className="size-4 transition-transform duration-150 hover-fine:group-hover:-translate-x-1"
              style={{ transitionTimingFunction: EASE }}
            />
          </button>
        </div>
      </div>
    </section>
  );
}

/** One row of the field card: label above, icon leading, optional trailing control. */
function Field({
  id,
  label,
  icon: Icon,
  trailing,
  value,
  onChange,
  ...input
}: {
  id: string;
  label: string;
  icon: typeof Mail;
  trailing?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "id">) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className="px-4 py-3 transition-colors duration-150"
      style={{
        transitionTimingFunction: EASE,
        backgroundColor: focused ? "color-mix(in oklch, var(--primary) 4%, transparent)" : "transparent",
      }}
    >
      <label htmlFor={id} className="block text-xs font-bold text-foreground">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          {...input}
        />
        {trailing}
        <Icon
          className="size-4 shrink-0 transition-colors duration-150"
          style={{
            transitionTimingFunction: EASE,
            color: focused ? "var(--primary)" : "var(--muted-foreground)",
          }}
        />
      </div>
    </div>
  );
}
