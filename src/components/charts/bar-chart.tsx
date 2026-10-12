"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/domain/stats";
import { barGradient } from "@/components/charts/colors";
import { useInView } from "@/components/charts/use-in-view";

export type Bar = { key: string; label: string; value: number; tooltip: string; highlight?: boolean };
/** Unidad de los valores: activa las líneas guía con cifras y la media. */
export type BarUnit = "minutes" | "count";

const num = (v: number) => v.toLocaleString("es", { maximumFractionDigits: 1 });

/** Cifra corta para el eje ("2 h", "45 min", "12"). */
function compact(v: number, unit: BarUnit): string {
  if (unit === "minutes") return v >= 60 ? `${num(v / 60)} h` : `${Math.round(v)} min`;
  return num(v);
}

/** Primer valor "redondo" (1; 1,2; 1,6; 2; 3; 4; 5; 6; 8; 10 × 10ⁿ) que no queda por debajo de `x`; su mitad también es limpia. */
function niceCeil(x: number): number {
  if (x <= 0) return 1;
  const base = 10 ** Math.floor(Math.log10(x));
  for (const m of [1, 1.2, 1.6, 2, 3, 4, 5, 6, 8, 10]) if (m * base >= x - 1e-9) return m * base;
  return 10 * base;
}

/** Máximo del eje: con unidad, una cifra limpia (en horas enteras si pasa de una hora) y la mitad también. */
function axisMax(max: number, unit?: BarUnit): number {
  if (!unit) return max;
  if (unit === "minutes" && max > 60) return niceCeil(max / 60) * 60;
  const top = niceCeil(max);
  if (unit === "count") {
    const t = Math.max(2, Math.ceil(top));
    return t % 2 ? t + 1 : t;
  }
  return top;
}

/**
 * Gráfico de barras ligero y accesible: barras redondeadas con degradado (el color se intensifica con
 * el valor), líneas guía tenues, animación de entrada al aparecer en pantalla y tooltip al pasar el
 * ratón o tocar. Sin `color`, usa el tono de la sección (`--tone` → `--tone-2`).
 */
export function BarChart({
  bars,
  height = 140,
  color,
  color2,
  unit,
  average = false,
  className,
  emptyText = "Sin datos en este período",
}: {
  bars: Bar[];
  height?: number;
  color?: string;
  /** Color de la base de las barras (por defecto, el mismo color más transparente). */
  color2?: string;
  unit?: BarUnit;
  /** Línea discontinua con la media de las barras (requiere `unit`). */
  average?: boolean;
  className?: string;
  emptyText?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [ref, seen] = useInView<HTMLDivElement>();
  const max = Math.max(0, ...bars.map((b) => b.value));
  const n = bars.length || 1;
  // Etiquetas largas (p. ej. "28 sept") no caben todas en pantallas estrechas.
  const longLabels = bars.some((b) => b.label.length > 3);
  const showEvery = n > 40 ? Math.ceil(n / 10) : n > 16 ? Math.ceil(n / 8) : longLabels && n > 6 ? Math.ceil(n / 6) : 1;

  if (max === 0) {
    return (
      <div
        className={cn("relative grid place-items-center overflow-hidden rounded-2xl border border-dashed border-border-strong bg-surface/30 px-4 text-center text-sm text-muted", className)}
        style={{ height: Math.max(height, 110) }}
      >
        <div className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(60%_70%_at_50%_50%,#000,transparent)]" aria-hidden />
        <div className="relative flex flex-col items-center gap-2">
          <span className="tone-chip-soft h-9 w-9 rounded-xl [&_svg]:h-4 [&_svg]:w-4" aria-hidden>
            <BarChart3 />
          </span>
          {emptyText}
        </div>
      </div>
    );
  }

  const top = axisMax(max, unit);
  // Con el tono de la sección, las barras van de --tone (base) a --tone-2 (las más altas).
  const toned = !color || color === "var(--tone)";
  const main = toned ? "var(--tone-2)" : color;
  const base = color2 ?? (toned ? "var(--tone)" : undefined);
  const fill = barGradient(main, base);
  const avg = bars.reduce((a, b) => a + b.value, 0) / n;
  const gap = n > 40 ? 1 : n > 20 ? 2 : n > 12 ? 4 : 6;
  const barMax = n <= 12 ? 36 : 30;
  const anyHighlight = bars.some((b) => b.highlight);
  const guides = unit ? [0.5, 1] : [0.5];

  const tip = hover !== null ? bars[hover] : null;
  const tipPos = hover !== null ? (hover + 0.5) / n : 0;
  const [tipHead, ...tipRest] = tip ? tip.tooltip.split(": ") : [""];
  const tipBody = tipRest.join(": ");

  return (
    <div ref={ref} className={cn("relative min-w-0", className)}>
      <div className={cn("relative", unit && "pr-11")}>
        <div className="relative" style={{ height }}>
          {/* Rejilla: muy tenue, con la cifra del eje a la derecha. */}
          {guides.map((f) => (
            <div key={f} className="pointer-events-none absolute inset-x-0 h-px bg-border/70" style={{ bottom: `${f * 100}%` }} aria-hidden>
              {unit && <span className="absolute -right-11 w-10 -translate-y-1/2 text-right text-[10px] leading-none text-faint tabular">{compact(top * f, unit)}</span>}
            </div>
          ))}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border-strong" aria-hidden />
          {average && unit && avg > 0 && (
            <div className="pointer-events-none absolute inset-x-0 z-[1] border-t border-dashed border-text/30" style={{ bottom: `${(avg / top) * 100}%` }} aria-hidden />
          )}

          <div className="relative flex h-full items-end" role="img" aria-label={bars.map((b) => b.tooltip).join("; ")}>
            {bars.map((b, i) => {
              const pct = (b.value / top) * 100;
              const active = hover === i;
              return (
                <div
                  key={b.key}
                  className="relative flex h-full min-w-0 flex-1 cursor-pointer items-end justify-center"
                  style={{ paddingInline: gap / 2 }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setHover(hover === i ? null : i)}
                >
                  {b.value > 0 ? (
                    <div
                      className="w-full rounded-t-[5px]"
                      style={{
                        maxWidth: barMax,
                        height: `max(3px, ${pct}%)`,
                        backgroundImage: fill,
                        backgroundSize: `100% ${height}px`,
                        backgroundPosition: "bottom",
                        transformOrigin: "bottom",
                        transform: seen ? "scaleY(1)" : "scaleY(0)",
                        opacity: hover === null ? (anyHighlight && !b.highlight ? 0.82 : 1) : active ? 1 : 0.4,
                        filter: active ? "brightness(1.1) saturate(1.15)" : undefined,
                        boxShadow: b.highlight || active ? `0 0 18px -4px ${main}` : undefined,
                        transition: `transform 900ms var(--ease-out) ${Math.round((i / n) * 450)}ms, opacity 220ms ease, filter 220ms ease, box-shadow 220ms ease`,
                      }}
                    />
                  ) : (
                    <div className="h-[3px] w-full rounded-full bg-border" style={{ maxWidth: barMax }} />
                  )}
                </div>
              );
            })}
          </div>

          {tip && (
            <div
              className="pointer-events-none absolute z-20"
              style={{
                left: `${tipPos * 100}%`,
                bottom: `calc(${Math.min(100, (tip.value / top) * 100)}% + 10px)`,
                transform: `translateX(${tipPos < 0.18 ? "-14%" : tipPos > 0.82 ? "-86%" : "-50%"})`,
              }}
            >
              <div className="pop-in w-max max-w-[min(250px,78vw)] rounded-xl bg-text px-2.5 py-1.5 text-xs leading-snug text-bg shadow-pop [.card-feature_&]:bg-black/75 [.card-feature_&]:text-white [.card-feature_&]:backdrop-blur">
                {tipBody ? (
                  <>
                    <p className="text-[10.5px] font-medium opacity-70">{tipHead}</p>
                    <p className="font-semibold">{tipBody}</p>
                  </>
                ) : (
                  <p className="font-semibold">{tip.tooltip}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={cn("mt-2 flex", unit && "pr-11")} aria-hidden>
        {bars.map((b, i) => (
          <div
            key={b.key}
            className={cn(
              "min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[10.5px] text-muted transition-colors",
              (b.highlight || hover === i) && "font-semibold text-text",
            )}
          >
            {i % showEvery === 0 ? b.label : ""}
          </div>
        ))}
      </div>

      {average && unit && avg > 0 && (
        <p className="mt-2.5 flex items-center justify-end gap-1.5 text-[11px] text-muted">
          <span className="inline-block w-4 border-t border-dashed border-text/40" aria-hidden />
          Media: <span className="font-semibold text-text tabular">{unit === "minutes" ? formatDuration(avg * 60) : num(avg)}</span>
        </p>
      )}
    </div>
  );
}

/** Barra horizontal con etiqueta, punto de color y cifra a la derecha. Se rellena al aparecer en pantalla. */
export function HBar({ label, value, max, color, right }: { label: string; value: number; max: number; color: string; right: string }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const pct = max ? Math.max(0, Math.min(1, value / max)) * 100 : 0;
  return (
    <div ref={ref} className="group -mx-2.5 rounded-2xl px-2.5 py-2 transition-colors duration-200 hover:bg-surface-2/60">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2.5 font-medium">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full transition-transform duration-300 group-hover:scale-125"
            style={{ backgroundColor: color, boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 22%, transparent)` }}
            aria-hidden
          />
          <span className="truncate">{label}</span>
        </span>
        <span className="shrink-0 text-[12.5px] text-muted tabular">{right}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full"
          style={{
            width: seen ? `${pct}%` : 0,
            minWidth: value > 0 && seen ? 6 : 0,
            background: `linear-gradient(90deg, color-mix(in srgb, ${color} 55%, transparent), ${color})`,
            boxShadow: `0 0 12px -3px ${color}`,
            transition: "width 1000ms var(--ease-out)",
          }}
        />
      </div>
    </div>
  );
}
