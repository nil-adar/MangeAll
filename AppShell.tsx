import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, Home, Plus, Wallet, Camera, CalendarPlus, ListPlus, Receipt, ShoppingCart, Cake, Repeat, LogOut, ChevronRight } from "lucide-react";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ScopeSwitch } from "@/lib/scope";
import { supabase } from "@/lib/supabase";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

const tabs = [
  { to: "/", label: "היום", icon: Home },
  { to: "/calendar", label: "לוח שנה", icon: CalendarDays },
  { to: "/tasks", label: "משימות", icon: CheckCircle2 },
  { to: "/finance", label: "כספים", icon: Wallet },
] as const;

const quickActions = [
  { label: "אירוע חדש", icon: CalendarPlus, to: "/event/new", search: { type: "event" } },
  { label: "יום הולדת", icon: Cake, to: "/event/new", search: { type: "birthday" } },
  { label: "משימה חדשה", icon: ListPlus, to: "/event/new", search: { type: "task" } },
  { label: "רשימת קניות", icon: ShoppingCart, to: "/shopping", search: undefined },
  { label: "הוצאה קבועה", icon: Repeat, to: "/expense/new", search: { mode: "fixed" } },
  { label: "הוצאה מזדמנת", icon: Receipt, to: "/expense/new", search: { mode: "once" } },
  { label: "סריקת קבלה", icon: Camera, to: "/expense/new", search: { mode: "scan" } },
] as const;



export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isTabPage = tabs.some((t) => t.to === pathname);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email ?? null);
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  // First letter of email for avatar
  const avatarLetter = userEmail ? userEmail[0].toUpperCase() : "?";

  return (
    <div className="app-shell bg-background">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 px-5 pb-3 pt-5 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {!isTabPage && (
              <button
                onClick={() => navigate({ to: -1 as never })}
                className="shrink-0 flex items-center justify-center size-8 rounded-xl active:scale-[0.92] transition-[transform,background-color] duration-[160ms] hover-fine:hover:bg-muted"
                style={{ transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
                aria-label="חזרה"
              >
                <ChevronRight className="size-5 text-muted-foreground" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
              {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold active:scale-[0.92] transition-[transform,opacity] duration-[160ms]"
              style={{ transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
              aria-label="תפריט משתמש"
            >
              {avatarLetter}
            </button>
            {menuOpen && (
              <div
                className="absolute left-0 top-12 z-50 min-w-[180px] rounded-2xl border border-border bg-card p-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-150"
                style={{ transformOrigin: "top right" }}
                onClick={() => setMenuOpen(false)}
              >
                {userEmail && (
                  <p className="truncate px-3 py-2 text-xs text-muted-foreground border-b border-border mb-1">
                    {userEmail}
                  </p>
                )}
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-destructive transition-colors duration-150 active:bg-muted"
                >
                  <LogOut className="size-4" />
                  התנתק
                </button>
              </div>
            )}
          </div>
        </div>
        {tabs.some((t) => t.to === pathname) && pathname !== "/finance" && (
          <div className="mt-3">
            <ScopeSwitch />
          </div>
        )}
      </header>



      <main className="px-5 pt-4 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[30rem] border-t border-border/70 bg-background/85 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
        <ul className="flex items-end justify-between">
          {tabs.slice(0, 2).map((t) => (
            <NavTab key={t.to} {...t} active={pathname === t.to} />
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
                <div className="grid grid-cols-2 gap-3 p-4 pb-8 stagger-list">
                  {quickActions.map((a) => {
                    const inner = (
                      <>
                        <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                          <a.icon className="size-5" />
                        </span>
                        <span className="text-sm font-semibold">{a.label}</span>
                      </>
                    );
                    const className =
                      "flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-4 text-right shadow-[var(--shadow-card)] transition-[transform,background-color] duration-[160ms] active:scale-[0.97] active:bg-muted";
                    return (
                      <Link
                        key={a.label}
                        to={a.to}
                        search={a.search as never}
                        onClick={() => setOpen(false)}
                        className={className}
                        style={{ transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
                      >
                        {inner}
                      </Link>
                    );

                  })}
                </div>

              </DrawerContent>
            </Drawer>
          </li>

          {tabs.slice(2).map((t) => (
            <NavTab key={t.to} {...t} active={pathname === t.to} />
          ))}
        </ul>
      </nav>
    </div>
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
