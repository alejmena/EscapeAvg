"use client";

import type { XpSource } from "@/lib/domain/gamification";
import { useInView } from "@/components/charts/use-in-view";
import { SOURCE_META } from "@/components/progress/meta";

/**
 * Reparto del XP de la semana: una barra apilada con todas las fuentes y, debajo, una fila por fuente.
 * Las barras se rellenan al aparecer en pantalla.
 */
export function XpSources({ items }: { items: { key: XpSource; label: string; value: number }[] }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const total = items.reduce((a, b) => a + b.value, 0);
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div ref={ref}>
      <div className="flex items-end justify-between gap-3">
        <p className="num-xl text-[40px] sm:text-[44px]">
          {total.toLocaleString("es")}
          <span className="ml-1.5 font-sans text-base font-semibold tracking-normal text-muted">XP</span>
        </p>
        <p className="pb-1 text-xs text-muted">
          {items.length} {items.length === 1 ? "fuente" : "fuentes"}
        </p>
      </div>
      {/* Barra apilada: cada tramo, del color de su sección. */}
      <div className="mt-3 flex h-3.5 w-full gap-[3px] overflow-hidden rounded-full bg-surface-2" aria-hidden>
        {items.map((s, i) => (
          <span
            key={s.key}
            data-tone={SOURCE_META[s.key].tone}
            className="h-full rounded-full bg-gradient-to-r from-tone to-tone-2"
            style={{
              flexBasis: seen ? `${(s.value / total) * 100}%` : "0%",
              flexGrow: 0,
              flexShrink: 0,
              minWidth: seen ? 6 : 0,
              transition: `flex-basis 900ms var(--ease-out) ${i * 90}ms`,
            }}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-1">
        {items.map((s, i) => {
          const { tone, icon: Icon } = SOURCE_META[s.key];
          const pct = Math.round((s.value / total) * 100);
          return (
            <li key={s.key} data-tone={tone} className="group -mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-surface-2/60">
              <span className="tone-chip-soft h-9 w-9 rounded-xl transition-transform duration-300 group-hover:scale-105">
                <Icon size={16} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{s.label}</span>
                  <span className="shrink-0 tabular">
                    <span className="font-semibold">{s.value} XP</span>
                    <span className="ml-1.5 text-xs text-muted">{pct} %</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-tone to-tone-2 shadow-[0_0_10px_-2px_var(--tone)]"
                    style={{ width: seen ? `${(s.value / max) * 100}%` : 0, transition: `width 1000ms var(--ease-out) ${120 + i * 80}ms` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
