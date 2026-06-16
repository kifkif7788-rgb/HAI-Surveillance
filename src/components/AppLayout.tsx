import { createContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Home, Users, FileBarChart, LayoutDashboard, Settings, UserCog, CalendarDays, LogOut, Target } from "lucide-react";
import mascot from "@/assets/mascot.png";
import { OR_DEPTS } from "@/lib/or-store";
import { wardNames } from "@/lib/ward-store";
import { cn } from "@/lib/utils";

export type ViewKey = "record" | "patients" | "reports" | "dashboard" | "monthly" | "kpi" | "settings" | "users";
export const HeaderActionsContext = createContext<(node: ReactNode) => void>(() => {});

/** Decide whether a user may see a nav item. */
function canSee(key: ViewKey, user?: AppUser): boolean {
  if (key === "users")   return !!user?.isAdmin;
  if (key === "monthly") return !!user?.isAdmin || (!!user && (wardNames().includes(user.role) || (OR_DEPTS as readonly string[]).includes(user.role)));
  return true;
}

const NAV: { key: ViewKey; label: string; icon: typeof Home }[] = [
  { key: "record",    label: "บันทึกข้อมูล",  icon: Home },
  { key: "patients",  label: "รายการผู้ป่วย",  icon: Users },
  { key: "reports",   label: "รายงานสรุป",     icon: FileBarChart },
  { key: "dashboard", label: "Dashboard",      icon: LayoutDashboard },
  { key: "monthly",   label: "ข้อมูลรายเดือน",  icon: CalendarDays },
  { key: "kpi",       label: "ตัวชี้วัด",       icon: Target },
  { key: "settings",  label: "ตั้งค่า",         icon: Settings },
  { key: "users",     label: "จัดการผู้ใช้",    icon: UserCog },
];

interface AppUser { id: string; name: string; role: string; emoji: string; isAdmin: boolean }

export function AppLayout({
  view, setView, children, title, user, onLogout,
}: {
  view: ViewKey; setView: (v: ViewKey) => void; children: ReactNode; title: string;
  user?: AppUser; onLogout?: () => void;
}) {
  const [open, setOpen]                   = useState(false);
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Measure actual header height → CSS variable used by all sticky children
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () =>
      document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <HeaderActionsContext.Provider value={setHeaderActions}>
      <div className="min-h-screen flex">
        {/* Mobile backdrop */}
        {open && (
          <div
            className="fixed inset-0 z-30 bg-black/20 lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        {/* ── Sidebar ── */}
        <aside className={cn(
          "fixed lg:sticky lg:top-3 lg:self-start lg:h-[calc(100vh-1.5rem)]",
          "z-40 inset-y-0 left-0 w-56 transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          "m-3 rounded-3xl overflow-hidden flex flex-col",
          "bg-white/95 shadow-[0_8px_32px_-8px_oklch(0.7_0.1_280/0.2)] border border-white/80"
        )}>

          {/* Logo */}
          <div className="flex items-center gap-3 p-4 border-b border-border/30">
            <img
              src={mascot} width={52} height={52} alt=""
              className="rounded-full shadow-sm ring-2 ring-sky/30 bg-sky/10 shrink-0"
            />
            <div className="min-w-0">
              <div className="font-bold text-primary text-sm leading-tight truncate">HAI Surveillance</div>
              <div className="text-[10px] text-muted-foreground truncate">Infection Surveillance System</div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
            {NAV.filter((n) => canSee(n.key, user)).map((n) => {
              const Icon  = n.icon;
              const active = view === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() => { setView(n.key); setOpen(false); }}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm transition-all text-left w-full",
                    active
                      ? "bg-sky/25 text-sky-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}>
                  <Icon className={cn("w-4 h-4 shrink-0", active ? "text-primary" : "")} />
                  {n.label}
                </button>
              );
            })}

            <button
              onClick={() => { setOpen(false); onLogout?.(); }}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm text-pink-foreground hover:bg-pink/15 transition-all w-full mt-1">
              <LogOut className="w-4 h-4 shrink-0" />
              ออกจากระบบ
            </button>
          </nav>

          {/* Bottom illustration area */}
          <div className="border-t border-border/20 bg-gradient-to-b from-mint/5 to-mint/20 p-3">
            <div className="flex items-end justify-center gap-1 h-16 relative">
              {/* decorative hearts */}
              <span className="absolute left-2 top-0 text-pink-foreground text-xs animate-pulse">💕</span>
              <span className="absolute right-3 top-1 text-pink-foreground text-[10px] animate-pulse" style={{animationDelay:"0.5s"}}>💕</span>
              {/* characters */}
              <span className="text-[44px] leading-none">🐰</span>
              <span className="text-[36px] leading-none self-end mb-1">🐣</span>
              <span className="text-[28px] leading-none self-end">🌿</span>
              <span className="text-[20px] leading-none self-end mb-0.5">🌸</span>
            </div>
            <p className="text-center text-[10px] text-muted-foreground mt-1">v1.0 • โรงพยาบาลเด็ก 💖</p>
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 min-w-0 flex flex-col">

          {/* Decorated sticky header — flush to top edge, full width of main */}
          <header ref={headerRef} className="sticky top-0 z-30 relative overflow-hidden bg-white/95 backdrop-blur-md border-b border-border/30 shadow-sm">

            {/* Rainbow top strip */}
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{ background: "linear-gradient(90deg,oklch(0.85 0.18 350),oklch(0.88 0.18 40),oklch(0.92 0.17 90),oklch(0.88 0.14 150),oklch(0.84 0.13 220),oklch(0.84 0.11 280),oklch(0.85 0.13 310))" }}
            />

            {/* Header content */}
            <div className="relative z-10 flex items-center justify-between gap-3 px-4 lg:px-6 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  className="lg:hidden card-soft p-2 rounded-xl shrink-0 text-sm"
                  onClick={() => setOpen(!open)}
                  aria-label="menu">☰</button>
                <h1 className="text-base lg:text-lg font-bold text-primary flex items-center gap-2 min-w-0">
                  <span className="text-xl shrink-0">📋</span>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap leading-relaxed py-0.5">{title}</span>
                </h1>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {headerActions}
                {/* User chip */}
                <div className="ml-1 bg-white rounded-2xl border border-border/50 shadow-sm px-3 py-1.5 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-pink/40 grid place-items-center text-base shrink-0">{user?.emoji ?? "👩‍⚕️"}</div>
                  <div className="hidden sm:block">
                    <div className="text-xs font-semibold leading-tight">{user?.name ?? "ผู้ใช้งาน"}</div>
                    <div className="text-[10px] text-muted-foreground">{user?.role ?? "—"}</div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Padded content area — pt provides the gap below the flush header */}
          <div className="flex-1 px-3 lg:px-5 pt-3 lg:pt-5 pb-3 lg:pb-5">
            {children}
          </div>
        </main>
      </div>
    </HeaderActionsContext.Provider>
  );
}
