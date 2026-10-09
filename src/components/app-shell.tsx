"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  CheckSquare,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  StickyNote,
  Target,
  Timer,
  Trophy,
  Users,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ActiveSessionPill } from "@/components/focus/active-session-pill";
import { Modal } from "@/components/ui/modal";
import { signOut } from "@/app/(auth)/actions";
import { cn } from "@/lib/cn";
import type { FocusSession } from "@/lib/types";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; hint: string };

/** Secciones agrupadas por intención: hacer hoy, organizar y mirar tu evolución. */
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Hoy",
    items: [
      { href: "/dashboard", label: "Inicio", icon: LayoutDashboard, hint: "Resumen del día" },
      { href: "/plan", label: "Plan", icon: CalendarClock, hint: "Qué hacer hoy" },
      { href: "/tasks", label: "Tareas", icon: CheckSquare, hint: "Tus pendientes" },
      { href: "/focus", label: "Concentración", icon: Timer, hint: "Temporizador" },
      { href: "/habits", label: "Hábitos", icon: Flame, hint: "Rutinas y rachas" },
    ],
  },
  {
    title: "Organiza",
    items: [
      { href: "/notes", label: "Notas", icon: StickyNote, hint: "Tablero de ideas" },
      { href: "/goals", label: "Objetivos", icon: Target, hint: "Metas medibles" },
    ],
  },
  {
    title: "Tu evolución",
    items: [
      { href: "/stats", label: "Estadísticas", icon: BarChart3, hint: "Tus datos reales" },
      { href: "/progress", label: "Progreso", icon: Trophy, hint: "Nivel, XP y logros" },
      { href: "/social", label: "Social", icon: Users, hint: "Amigos y grupos" },
    ],
  },
];

const NAV = NAV_GROUPS.flatMap((g) => g.items);
const MOBILE_NAV = ["/dashboard", "/plan", "/tasks", "/focus"];

export function AppShell({
  children,
  name,
  activeSession,
  pendingRequests = 0,
}: {
  children: React.ReactNode;
  name: string;
  activeSession: FocusSession | null;
  pendingRequests?: number;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const inMore = !MOBILE_NAV.some(isActive);
  const current = NAV.find((n) => isActive(n.href)) ?? (isActive("/settings") ? { label: "Ajustes" } : null);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-border bg-surface px-3 py-5 lg:flex">
        <Link href="/dashboard" className="mb-6 px-2">
          <Logo />
        </Link>
        <nav className="flex flex-1 flex-col gap-5" aria-label="Principal">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted/80">{group.title}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                      isActive(href) ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-2 hover:text-text",
                    )}
                    aria-current={isActive(href) ? "page" : undefined}
                  >
                    <Icon size={18} className={cn("shrink-0 transition-transform", !isActive(href) && "group-hover:scale-110")} />
                    {label}
                    {href === "/social" && pendingRequests > 0 && (
                      <span className="ml-auto rounded-full bg-accent px-1.5 text-[11px] font-medium text-accent-fg" aria-label={`${pendingRequests} solicitudes de amistad`}>
                        {pendingRequests}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-6 space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between px-2">
            <ThemeToggle />
            <Link
              href="/settings"
              className={cn("rounded-lg p-2 hover:bg-surface-2 hover:text-text", isActive("/settings") ? "bg-accent-soft text-accent" : "text-muted")}
              title="Ajustes"
              aria-label="Ajustes"
              aria-current={isActive("/settings") ? "page" : undefined}
            >
              <Settings size={18} />
            </Link>
          </div>
          <div className="flex items-center justify-between gap-2 px-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent" aria-hidden>
                {initial}
              </span>
              <span className="truncate text-sm text-muted">{name}</span>
            </span>
            <form action={signOut}>
              <button type="submit" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" title="Cerrar sesión" aria-label="Cerrar sesión">
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-bg/80 px-4 py-2.5 backdrop-blur lg:hidden">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
            <Logo compact />
            {current && <span className="truncate text-sm font-medium text-muted">{current.label}</span>}
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/social" className="relative rounded-lg p-2 text-muted hover:bg-surface-2" aria-label={pendingRequests > 0 ? `Social: ${pendingRequests} solicitudes` : "Social"}>
              <Users size={19} />
              {pendingRequests > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" aria-hidden />}
            </Link>
            <Link href="/settings" className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="Ajustes">
              <Settings size={19} />
            </Link>
          </div>
        </header>
        <main key={pathname} className="animate-in mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-32 sm:px-6 lg:py-8 lg:pb-10">
          {children}
        </main>
      </div>

      {activeSession && !pathname.startsWith("/focus") && <ActiveSessionPill session={activeSession} />}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Navegación móvil"
      >
        {NAV.filter((n) => MOBILE_NAV.includes(n.href)).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={cn("flex flex-col items-center gap-1 py-2 text-[11px]", isActive(href) ? "font-medium text-accent" : "text-muted")}
          >
            <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", isActive(href) && "bg-accent-soft")}>
              <Icon size={20} />
            </span>
            {label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          className={cn("relative flex flex-col items-center gap-1 py-2 text-[11px]", inMore ? "font-medium text-accent" : "text-muted")}
        >
          <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", inMore && "bg-accent-soft")}>
            <Menu size={20} />
          </span>
          Más
          {pendingRequests > 0 && <span className="absolute right-[calc(50%-18px)] top-2 h-2 w-2 rounded-full bg-accent" aria-hidden />}
        </button>
      </nav>

      <Modal
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="Todas las secciones"
        sheet
        className="lg:hidden"
      >
        <div className="space-y-4 pb-[env(safe-area-inset-bottom)]">
          {NAV_GROUPS.map((group) => (
            <section key={group.title}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{group.title}</p>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map(({ href, label, icon: Icon, hint }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={isActive(href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                      isActive(href) ? "border-accent bg-accent-soft text-accent" : "border-border hover:bg-surface-2",
                    )}
                  >
                    <Icon size={20} className="shrink-0" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        {label}
                        {href === "/social" && pendingRequests > 0 && (
                          <span className="rounded-full bg-accent px-1.5 text-[10px] text-accent-fg">{pendingRequests}</span>
                        )}
                      </span>
                      <span className="block truncate text-[11px] text-muted">{hint}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
          <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
            <ThemeToggle />
            <div className="flex items-center gap-1">
              <Link href="/settings" onClick={() => setMoreOpen(false)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2">
                <Settings size={16} /> Ajustes
              </Link>
              <form action={signOut}>
                <button type="submit" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2">
                  <LogOut size={16} /> Salir
                </button>
              </form>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
