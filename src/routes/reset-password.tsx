import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase sets a recovery session when user arrives via the reset link
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Also check existing session (in case page was refreshed)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("הסיסמאות אינן תואמות");
      return;
    }
    if (password.length < 6) {
      setError("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate({ to: "/" });
    }
  }

  if (!ready) {
    return (
      <div dir="rtl" className="flex min-h-svh items-center justify-center bg-background px-4">
        <div className="text-center space-y-3">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">מאמת קישור…</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">סיסמה חדשה</h1>
          <p className="mt-1 text-sm text-muted-foreground">הכנס סיסמה חדשה לחשבון שלך</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            placeholder="סיסמה חדשה"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="password"
            placeholder="אימות סיסמה"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "שומר…" : "שמור סיסמה"}
          </button>
        </form>
      </div>
    </div>
  );
}
