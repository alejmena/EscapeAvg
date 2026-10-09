"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/stats", label: "Resumen" },
  { href: "/stats/development", label: "Desarrollo" },
  { href: "/stats/trends", label: "Tendencias" },
  { href: "/stats/patterns", label: "Horarios y patrones" },
  { href: "/stats/projects", label: "Proyectos" },
];

export function StatsTabs() {
  const pathname = usePathname();
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1" aria-label="Secciones de estadísticas">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
              active ? "border-accent font-medium text-text" : "border-transparent text-muted hover:text-text",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
