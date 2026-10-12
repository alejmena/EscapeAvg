"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Play, Settings, Users } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { ActiveSessionPill } from "@/components/focus/active-session-pill";
import { Interactions } from "@/components/fx/interactions";
import { Modal } from "@/components/ui/modal";
import { signOut } from "@/app/(auth)/actions";
import { cn } from "@/lib/cn";
import { NAV_GROUPS, SECTIONS, sectionFor } from "@/lib/sections";
import type { FocusSession } from "@/lib/types";

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
  const section = sectionFor(pathname);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <Interactions />
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-card-border bg-[color-mix(in_srgb,var(--surface)_55%,transparent)] px-4 py-6 backdrop-blur-2xl lg:flex">
        <Link href="/dashboard" className="mb-6 shrink-0 px-2">
          <Logo />
        </Link>
        <Link
          href="/focus"
          data-tone="coral"
          className="press shine group mb-6 flex shrink-0 items-center gap-3 rounded-2xl bg-gradient-to-br from-tone to-tone-2 p-3 text-white shadow-[0_14px_28px_-14px_var(--tone)]"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/20">
            <Play size={16} className="fill-white transition-transform group-hover:scale-110" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-semibold">Concentrarme</span>
            <span className="block text-[11.5px] text-white/80">Empieza una sesión</span>
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-4" aria-label="Principal">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-faint">{group.title}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map(({ href, label, icon: Icon, tone }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      data-tone={tone}
                      className={cn(
                        "press group relative flex items-center gap-3 rounded-xl px-2 py-1 text-sm",
                        active
                          ? "bg-surface font-semibold text-text shadow-[0_1px_2px_rgb(21_19_43/0.06),0_0_0_1px_var(--card-edge)] dark:bg-surface-2"
                          : "text-muted hover:bg-surface/60 hover:text-text dark:hover:bg-surface-2/60",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      {active && <span className="absolute -left-4 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-tone to-tone-2" aria-hidden />}
                      <span
                        className={cn(
                          "h-7 w-7 rounded-[9px] transition-transform duration-300 group-hover:scale-105",
                          active ? "tone-chip" : "tone-chip-soft",
                        )}
                      >
                        <Icon size={15} />
                      </span>
                      {label}
                      {href === "/social" && pendingRequests > 0 && (
                        <span className="ml-auto rounded-full bg-gradient-to-r from-tone to-tone-2 px-1.5 text-[11px] font-semibold text-white" aria-label={`${pendingRequests} solicitudes de amistad`}>
                          {pendingRequests}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-6 shrink-0 space-y-3 rounded-2xl border border-card-border bg-surface/50 p-3 shadow-[0_0_0_1px_var(--card-edge)] dark:bg-surface-2/40">
          <div className="flex items-center justify-between gap-2">
            <Link href="/settings" className="flex min-w-0 items-center gap-2.5 rounded-xl" title="Ajustes">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[image:var(--brand-gradient)] text-sm font-bold text-white shadow-[0_6px_14px_-6px_var(--accent)]" aria-hidden>
                {initial}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-semibold">{name}</span>
                <span className="block text-[11px] text-muted">Ver ajustes</span>
              </span>
            </Link>
            <form action={signOut}>
              <button type="submit" className="press rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text" title="Cerrar sesión" aria-label="Cerrar sesión">
                <LogOut size={16} />
              </button>
            </form>
          </div>
          <div className="flex items-center justify-between">
            <ThemeToggle />
            <Link
              href="/settings"
              className={cn("press rounded-lg p-2 hover:bg-surface-2 hover:text-text", isActive("/settings") ? "bg-accent-soft text-accent" : "text-muted")}
              title="Ajustes"
              aria-label="Ajustes"
              aria-current={isActive("/settings") ? "page" : undefined}
            >
              <Settings size={17} />
            </Link>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="glass sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-card-border px-4 py-2.5 lg:hidden">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
            <Logo compact />
            {section && <span className="truncate font-display text-[17px] font-semibold">{section.label}</span>}
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/social" className="press relative rounded-full p-2 text-muted hover:bg-surface-2" aria-label={pendingRequests > 0 ? `Social: ${pendingRequests} solicitudes` : "Social"}>
              <Users size={19} />
              {pendingRequests > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent-3" aria-hidden />}
            </Link>
            <Link href="/settings" className="press rounded-full p-2 text-muted hover:bg-surface-2" aria-label="Ajustes">
              <Settings size={19} />
            </Link>
          </div>
        </header>
        <main
          key={pathname}
          data-tone={section?.tone ?? "violet"}
          className="page-in mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-36 sm:px-6 lg:px-10 lg:py-10 lg:pb-12"
        >
          {children}
        </main>
      </div>

      {activeSession && !pathname.startsWith("/focus") && <ActiveSessionPill session={activeSession} />}

      <nav
        className="glass fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 grid grid-cols-5 rounded-[28px] border border-card-border px-1.5 py-1 shadow-pop lg:hidden"
        aria-label="Navegación móvil"
      >
        {NAV.filter((n) => MOBILE_NAV.includes(n.href)).map(({ href, label, icon: Icon, tone }) => (
          <Link
            key={href}
            href={href}
            data-tone={tone}
            aria-current={isActive(href) ? "page" : undefined}
            className={cn("press flex flex-col items-center gap-0.5 py-1.5 text-[10.5px]", isActive(href) ? "font-semibold text-tone-ink" : "text-muted")}
          >
            <span
              className={cn(
                "grid h-8 w-12 place-items-center rounded-full transition-all duration-300",
                isActive(href) && "bg-gradient-to-br from-tone to-tone-2 text-white shadow-[0_8px_18px_-8px_var(--tone)]",
              )}
            >
              <Icon size={20} />
            </span>
            {label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          data-tone={inMore ? (section?.tone ?? "violet") : "violet"}
          className={cn("press relative flex flex-col items-center gap-0.5 py-1.5 text-[10.5px]", inMore ? "font-semibold text-tone-ink" : "text-muted")}
        >
          <span
            className={cn(
              "grid h-8 w-12 place-items-center rounded-full transition-all duration-300",
              inMore && "bg-gradient-to-br from-tone to-tone-2 text-white shadow-[0_8px_18px_-8px_var(--tone)]",
            )}
          >
            <Menu size={20} />
          </span>
          Más
          {pendingRequests > 0 && <span className="absolute right-[calc(50%-18px)] top-2 h-2 w-2 rounded-full bg-accent-3" aria-hidden />}
        </button>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Todas las secciones" sheet className="lg:hidden">
        <div className="space-y-5 pb-[env(safe-area-inset-bottom)]">
          {NAV_GROUPS.map((group) => (
            <section key={group.title}>
              <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-faint">{group.title}</p>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map(({ href, label, icon: Icon, hint, tone }) => (
                  <Link
                    key={href}
                    href={href}
                    data-tone={tone}
                    onClick={() => setMoreOpen(false)}
                    aria-current={isActive(href) ? "page" : undefined}
                    className={cn(
                      "press flex items-center gap-3 rounded-2xl border p-2.5",
                      isActive(href) ? "border-tone/40 bg-tone-soft" : "border-border hover:bg-surface-2",
                    )}
                  >
                    <span className="tone-chip h-9 w-9 rounded-xl">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        {label}
                        {href === "/social" && pendingRequests > 0 && (
                          <span className="rounded-full bg-tone px-1.5 text-[10px] text-white">{pendingRequests}</span>
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
              <Link href={SECTIONS.settings.href} onClick={() => setMoreOpen(false)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2">
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
