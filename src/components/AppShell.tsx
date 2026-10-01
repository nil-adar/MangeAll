import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Home, Plus, Wallet, CalendarPlus, ListPlus, Receipt, ShoppingCart, Cake, PartyPopper, Repeat, LogOut, ChevronRight, User, Briefcase } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ScopeSwitch } from "@/lib/scope";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/queries";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// Four tabs, two on each side, so the + sits in the true centre of the bar.
// Calendar and tasks share one "יומן" tab and switch between each other
// with the segmented control in the header (see PLANNER below).
const tabs = [
  { to: "/", label: "היום", icon: Home, match: ["/"] },
  { to: "/calendar", label: "יומן", icon: CalendarDays, match: ["/calendar", "/tasks"] },
  { to: "/shopping", label: "קניות", icon: ShoppingCart, match: ["/shopping"] },
  { to: "/finance", label: "כספים", icon: Wallet, match: ["/finance"] },
] as const;

const PLANNER = [
  { to: "/calendar", label: "לוח שנה" },
  { to: "/tasks", label: "משימות" },
] as const;

// Grouped by area so the sheet reads as "what kind of thing", not a flat list.
const quickGroups = [
  {
    title: "יומן ומשימות",
    items: [
      { label: "משימה", icon: ListPlus, to: "/event/new", search: { type: "task" } },
      { label: "אירוע", icon: CalendarPlus, to: "/event/new", search: { type: "event" } },
      { label: "יום הולדת", icon: Cake, to: "/event/new", search: { type: "birthday" } },
      { label: "שמחה", icon: PartyPopper, to: "/event/new", search: { type: "occasion" } },
    ],
  },
  {
    title: "כסף",
    items: [
      { label: "הוצאה מזדמנת", icon: Receipt, to: "/expense/new", search: { mode: "once" } },
      { label: "הוצאה קבועה", icon: Repeat, to: "/expense/new", search: { mode: "fixed" } },
      // Receipt scanning (mode "scan") is still a "בקרוב" placeholder — it comes
      // back here once it works, not before: a dead end in the main menu costs trust.
    ],
  },
  {
    title: "עוד",
    items: [
      { label: "פריט לקניות", icon: ShoppingCart, to: "/shopping", search: undefined },
      { label: "יום עבודה", icon: Briefcase, to: "/workday", search: undefined },
    ],
  },
] as const;

/**
 * Where the back arrow goes from each non-tab page.
 *
 * An explicit map instead of history.back(): a page opened from a link, a
 * refresh or a PWA shortcut has no in-app history, so "back" would leave the
 * app entirely. (The previous `navigate({ to: -1 })` was worse — TanStack's
 * `to` takes a path, so -1 routed to a nonexistent page and hit the 404.)
 */
const PARENT: Record<string, string> = {
  "/birthdays": "/calendar",
  "/occasions": "/calendar",
  "/event/new": "/calendar",
  "/expense/new": "/finance",
  "/profile": "/",
  "/workday": "/",
};

function parentOf(pathname: string): string {
  return PARENT[pathname] ?? "/";
}

export function AppShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isTabPage = tabs.some((t) => (t.match as readonly string[]).includes(pathname));
  const isPlanner = PLANNER.some((p) => p.to === pathname);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: profile } = useProfile();

  const userEmail = profile?.email ?? null;
  const displayName = profile?.display_name ?? null;
  const avatarUrl = profile?.avatar_url ?? null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  // Prefer the chosen display name, fall back to the account email
  const avatarLetter = (displayName || userEmail || "?").charAt(0).toUpperCase();

  return (
    <div className="app-shell bg-background">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 px-5 pb-3 pt-5 backdrop-blur-xl print:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {!isTabPage && (
              <button
                onClick={() => navigate({ to: parentOf(pathname) })}
                className="shrink-0 flex items-center justify-center size-8 rounded-xl active:scale-[0.92] transition-[transform,background-color] duration-[160ms] hover-fine:hover:bg-muted"
                style={{ transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
                aria-label="חזרה"
              >
                <ChevronRight className="size-5 text-muted-foreground" />
              </button>
            )}
            <div className="min-w-0">
              {isPlanner ? (
                <>
                  <h1 className="sr-only">{title}</h1>
                  <PlannerSwitch pathname={pathname} />
                </>
              ) : (
                <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
              )}
              {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-transform duration-[160ms] active:scale-[0.92]"
                style={{ transitionTimingFunction: "var(--ease-out)" }}
                aria-label="תפריט משתמש"
              >
                {avatarLetter}
                {avatarUrl && (
                  <AvatarThumb key={avatarUrl} src={avatarUrl} />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={8}
              className="min-w-[180px] rounded-2xl border border-border bg-card p-1 shadow-lg"
            >
              {userEmail && (
                <DropdownMenuLabel className="mb-1 truncate border-b border-border px-3 py-2 text-xs font-normal text-muted-foreground">
                  {displayName || userEmail}
                </DropdownMenuLabel>
              )}
              <DropdownMenuItem
                onSelect={() => navigate({ to: "/profile" })}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-150 focus:bg-muted"
              >
                <User className="size-4" />
                פרופיל
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={handleLogout}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-destructive transition-colors duration-150 focus:bg-muted focus:text-destructive"
              >
                <LogOut className="size-4" />
                התנתק
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {/* The scope switch only applies to pages that filter by category */}
        {isTabPage && pathname !== "/finance" && pathname !== "/" && pathname !== "/shopping" && (
          <div className="mt-3">
            <ScopeSwitch />
          </div>
        )}
      </header>



      <main className="px-5 pt-4 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[30rem] border-t border-border/70 bg-background/85 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl print:hidden">
        <ul className="flex items-end justify-between">
          {tabs.slice(0, 2).map((t) => (
            <NavTab key={t.to} to={t.to} label={t.label} icon={t.icon} active={(t.match as readonly string[]).includes(pathname)} />
          ))}

          <li className="-mt-7">
            <Drawer open={open} onOpenChange={setOpen}>
              <DrawerTrigger
                aria-label="הוספה מהירה"
                className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-float)] transition-[transform,shadow] duration-[160ms] active:scale-[0.92]"
                style={{ transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
              >
                <Plus className="size-7" />
              </DrawerTrigger>
              <DrawerContent className="mx-auto max-w-[30rem]">
                <DrawerHeader className="text-right">
                  <DrawerTitle>מה נוסיף?</DrawerTitle>
                </DrawerHeader>
                <div className="space-y-5 p-4 pb-8">
                  {quickGroups.map((g) => (
                    <div key={g.title}>
                      <p className="eyebrow mb-2.5">{g.title}</p>
                      <div className="grid grid-cols-3 gap-2.5">
                        {g.items.map((a) => (
                          <Link
                            key={a.label}
                            to={a.to}
                            search={a.search as never}
                            onClick={() => setOpen(false)}
                            className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-2 py-3.5 text-center shadow-[var(--shadow-card)] transition-[transform,background-color] duration-[160ms] active:scale-[0.97] active:bg-muted"
                            style={{ transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
                          >
                            <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                              <a.icon className="size-5" />
                            </span>
                            <span className="text-[13px] font-semibold leading-tight">{a.label}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

              </DrawerContent>
            </Drawer>
          </li>

          {tabs.slice(2).map((t) => (
            <NavTab key={t.to} to={t.to} label={t.label} icon={t.icon} active={(t.match as readonly string[]).includes(pathname)} />
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** Calendar ⇄ tasks switch, shown in place of the title on the "יומן" tab. */
function PlannerSwitch({ pathname }: { pathname: string }) {
  return (
    <div className="flex rounded-2xl bg-muted p-1" role="tablist" aria-label="יומן">
      {PLANNER.map((p) => {
        const active = pathname === p.to;
        return (
          <Link
            key={p.to}
            to={p.to}
            role="tab"
            aria-selected={active}
            className={cn(
              "whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-bold transition-[background-color,color] duration-150",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover-fine:hover:text-foreground",
            )}
          >
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Avatar thumbnail. Crossfades over the initial letter once decoded so the
 * header doesn't flash an empty circle then snap to a photo on every mount.
 */
function AvatarThumb({ src }: { src: string }) {
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

function NavTab({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <li className="flex-1">
      <Link
        to={to}
        className={cn(
          "flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition-[transform,color] duration-[160ms] active:scale-[0.92]",
          active ? "text-primary" : "text-muted-foreground",
        )}
        style={{ transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
      >
        <Icon className={cn("size-5 transition-[stroke-width] duration-200", active && "stroke-[2.4]")} />
        {label}
      </Link>
    </li>
  );
}
