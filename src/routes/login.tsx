import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Check, CircleCheckBig } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const r = search["redirect"];
    // Only same-app paths. "//evil.com" and "https://…" are rejected, so a
    // crafted link can't bounce someone off-site after they sign in.
    return typeof r === "string" && /^\/(?!\/)/.test(r) ? { redirect: r } : {};
  },
  component: LoginPage,
});

const EASE = "var(--ease-out)";

/**
 * "Remember me", implemented rather than decorative: unchecked marks the
 * session as this-session-only, and AuthGuard signs out when the browser is
 * reopened. See SESSION_ONLY_KEY in routes/__root.tsx.
 */
const SESSION_ONLY_KEY = "nahel-hakol:session-only";

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [isRegister, setIsRegister] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Back to the page they asked for, or home. A full load rather than a
  // client-side navigate: the saved path can carry its own query string
  // ("/expense/new?mode=fixed"), which `navigate({ to })` does not parse.
  const goOn = () => {
    if (redirect) window.location.replace(redirect);
    else navigate({ to: "/" });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goOn();
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
    setLoading(true);
    setError(null);
    rememberChoice();

    if (isRegister) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setMessage("נשלח אימייל אישור — בדוק את תיבת הדואר שלך");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError("אימייל או סיסמה שגויים");
      else goOn();
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
  }

  return (
    <div dir="rtl" className="relative flex min-h-svh flex-col justify-center overflow-hidden bg-background px-5 py-10">
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
          <p className="mt-2 text-sm text-muted-foreground">היום שלך, מסודר</p>
        </div>

        {/* ── Title ── centred under the mark so the header reads as one block ── */}
        <div className="mt-8 text-center" style={{ animation: `fade-up 320ms ${EASE} 70ms both` }}>
          <h1 className="font-display text-[2rem] font-extrabold leading-tight tracking-tight">
            {isRegister ? "יצירת חשבון חדש" : "כניסה לחשבון"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isRegister ? "כמה פרטים קצרים והכול מוכן." : "טוב לראות אותך שוב."}
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
            { register: true, label: "הרשמה" },
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

        <form onSubmit={handleEmailAuth} style={{ animation: `fade-up 320ms ${EASE} 200ms both` }}>
          {/* ── Fields ── one card, rows divided by a hairline ── */}
          <div className="mt-5 overflow-hidden rounded-3xl border border-border bg-card">
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
