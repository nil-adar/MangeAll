import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ScopeProvider } from "../lib/scope";
import { supabase } from "../lib/supabase";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">הדף לא נמצא</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          הדף שחיפשת לא קיים.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            חזור לדף הבית
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          משהו השתבש
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          אירעה שגיאה. נסה לרענן את הדף.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            נסה שוב
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            דף הבית
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "נהל הכל – ניהול אישי פשוט" },
      {
        name: "description",
        content: "לוח זמנים, משימות, אירועים והוצאות – אפליקציה אישית בעברית להתקנה בנייד.",
      },
      { property: "og:title", content: "נהל הכל – ניהול אישי פשוט" },
      {
        property: "og:description",
        content: "לוח זמנים, משימות, אירועים והוצאות במקום אחד.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#F7F7F8" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "נהל הכל" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700;800&family=Heebo:wght@700;800;900&display=swap",
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * "Remember me" on the login screen, honoured here.
 *
 * Supabase keeps the session in localStorage, which survives a browser
 * restart. When the user unchecks the box we record that choice, and mark the
 * tab as alive in sessionStorage — which does NOT survive a restart. So on a
 * fresh launch the mark is gone and we sign out. Unchecked therefore means
 * "until I close the browser", which is what the checkbox promises.
 */
const SESSION_ONLY_KEY = "nahel-hakol:session-only";
const TAB_ALIVE_KEY = "nahel-hakol:tab-alive";

async function enforceSessionOnly(): Promise<boolean> {
  try {
    if (localStorage.getItem(SESSION_ONLY_KEY) !== "1") return false;
    if (sessionStorage.getItem(TAB_ALIVE_KEY) === "1") return false;
    // Session-only, and this is a brand-new browser session: drop it.
    await supabase.auth.signOut();
    localStorage.removeItem(SESSION_ONLY_KEY);
    return true;
  } catch {
    return false; // storage unavailable — leave the session alone
  } finally {
    try {
      sessionStorage.setItem(TAB_ALIVE_KEY, "1");
    } catch { /* ignore */ }
  }
}

function AuthGuard({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();
  // Public routes — reachable without a session.
  // /reset-password MUST be here: users arrive from the Supabase recovery
  // email with no session yet, and the PASSWORD_RECOVERY event fires only
  // after the page mounts. Redirecting them would break password reset.
  const PUBLIC_PATHS = ["/login", "/reset-password"];
  const isPublicPage = PUBLIC_PATHS.includes(router.state.location.pathname);

  // Where the user was trying to go, so login can send them back there
  // instead of dumping them on the home page and losing the link.
  const intended = router.state.location.pathname + router.state.location.searchStr;

  useEffect(() => {
    enforceSessionOnly().then(() =>
      supabase.auth.getSession().then(({ data }) => {
        setAuthed(!!data.session);
        setChecking(false);
        // Someone has an account on this device: /login opens on "כניסה"
        // for them next time instead of sign-up (KNOWN_DEVICE_KEY in login.tsx).
        if (data.session) {
          try {
            localStorage.setItem("nahel-hakol:has-account", "1");
          } catch {
            /* storage blocked */
          }
        }
        if (!data.session && !isPublicPage) {
          navigate({ to: "/login", search: { redirect: intended } });
        }
      })
    );

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
      if (!session && !isPublicPage) {
        navigate({ to: "/login", search: { redirect: intended } });
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [navigate, isPublicPage, intended]);

  if (checking) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!authed && !isPublicPage) return null;

  return <>{children}</>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ScopeProvider>
        <AuthGuard>
          <Outlet />
        </AuthGuard>
      </ScopeProvider>
    </QueryClientProvider>
  );
}
