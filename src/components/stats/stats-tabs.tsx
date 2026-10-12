"use client";

import { useEffect, useRef } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Clock3, FolderKanban, LayoutGrid, Loader2, Sprout, TrendingUp } from "lucide-react";

const TABS = [
  { href: "/stats", label: "Resumen", icon: LayoutGrid },
  { href: "/stats/development", label: "Desarrollo", icon: Sprout },
  { href: "/stats/trends", label: "Tendencias", icon: TrendingUp },
  { href: "/stats/patterns", label: "Horarios y patrones", icon: Clock3 },
  { href: "/stats/projects", label: "Proyectos", icon: FolderKanban },
];

/** Icono de la pestaña; mientras carga la página de destino, un indicador giratorio. */
function TabIcon({ icon: Icon }: { icon: (typeof TABS)[number]["icon"] }) {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Icon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" aria-hidden />;
}

export function StatsTabs() {
  const pathname = usePathname();
  const scroller = useRef<HTMLDivElement>(null);

  // En móvil la barra se desplaza: centra la pestaña activa.
  useEffect(() => {
    const el = scroller.current;
    const active = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !active || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2;
  }, [pathname]);

  return (
    <div ref={scroller} className="max-w-full overflow-x-auto rounded-full [scrollbar-width:none]">
      <nav className="seg p-1.5" aria-label="Secciones de estadísticas">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className="press group h-10 gap-2 px-4 text-[13.5px] [&>svg]:text-faint hover:[&>svg]:text-tone aria-[current=page]:bg-gradient-to-r aria-[current=page]:from-tone aria-[current=page]:to-tone-2 aria-[current=page]:text-white aria-[current=page]:shadow-[0_1px_0_rgb(255_255_255/0.3)_inset,0_10px_22px_-10px_var(--tone)] aria-[current=page]:[&>svg]:text-white"
            >
              <TabIcon icon={t.icon} />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
