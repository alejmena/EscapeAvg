"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CheckSquare, Flame, LayoutDashboard, LogOut, Settings, StickyNote, Target, Timer, Trophy, Users } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ActiveSessionPill } from "@/components/focus/active-session-pill";
import { signOut } from "@/app/(auth)/actions";
import { cn } from "@/lib/cn";
import type { FocusSession } from "@/lib/types";

const NAV = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/tasks", label: "Tareas", icon: CheckSquare },
  { href: "/focus", label: "Concentración", icon: Timer },
  { href: "/habits", label: "Hábitos", icon: Flame },
  { href: "/notes", label: "Notas", icon: StickyNote },
  { href: "/goals", label: "Objetivos", icon: Target },
  { href: "/stats", label: "Estadísticas", icon: BarChart3 },
  { href: "/progress", label: "Progreso", icon: Trophy },
  { href: "/social", label: "Social", icon: Users },
];

const MOBILE_NAV = ["/dashboard", "/tasks", "/focus", "/habits", "/stats"];

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
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface px-3 py-5 lg:flex">
        <Link href="/dashboard" className="mb-8 px-2">
          <Logo />
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5" aria-label="Principal">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                isActive(href) ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-2 hover:text-text",
              )}
              aria-current={isActive(href) ? "page" : undefined}
            >
              <Icon size={18} />
              {label}
              {href === "/social" && pendingRequests > 0 && (
                <span className="ml-auto rounded-full bg-accent px-1.5 text-[11px] font-medium text-accent-fg" aria-label={`${pendingRequests} solicitudes de amistad`}>
                  {pendingRequests}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between px-2">
            <ThemeToggle />
            <Link href="/settings" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" title="Ajustes" aria-label="Ajustes">
              <Settings size={18} />
            </Link>
          </div>
          <div className="flex items-center justify-between gap-2 px-2">
            <span className="truncate text-sm text-muted">{name}</span>
            <form action={signOut}>
              <button type="submit" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" title="Cerrar sesión" aria-label="Cerrar sesión">
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-bg/80 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/dashboard">
            <Logo compact />
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/notes" className="rounded-lg p-2 text-muted" aria-label="Notas">
              <StickyNote size={18} />
            </Link>
            <Link href="/progress" className="rounded-lg p-2 text-muted" aria-label="Progreso">
              <Trophy size={18} />
            </Link>
            <Link href="/social" className="relative rounded-lg p-2 text-muted" aria-label="Social">
              <Users size={18} />
              {pendingRequests > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" aria-hidden />}
            </Link>
            <Link href="/goals" className="rounded-lg p-2 text-muted" aria-label="Objetivos">
              <Target size={18} />
            </Link>
            <Link href="/settings" className="rounded-lg p-2 text-muted" aria-label="Ajustes">
              <Settings size={18} />
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 sm:px-6 lg:py-8 lg:pb-10">{children}</main>
      </div>

      {activeSession && !pathname.startsWith("/focus") && <ActiveSessionPill session={activeSession} />}

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 backdrop-blur lg:hidden" aria-label="Navegación móvil">
        {NAV.filter((n) => MOBILE_NAV.includes(n.href)).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px]", isActive(href) ? "text-accent" : "text-muted")}
          >
            <Icon size={20} />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
