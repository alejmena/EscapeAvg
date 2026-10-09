"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export type Bar = { key: string; label: string; value: number; tooltip: string; highlight?: boolean };

/** Gráfico de barras SVG ligero, accesible y con tooltip al pasar el ratón o tocar. */
export function BarChart({ bars, height = 140, color = "var(--accent)", className, emptyText = "Sin datos en este período" }: {
  bars: Bar[];
  height?: number;
  color?: string;
  className?: string;
  emptyText?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...bars.map((b) => b.value));
  const n = bars.length || 1;
  const gap = n > 40 ? 1 : n > 20 ? 2 : 4;
  const showEvery = n > 40 ? Math.ceil(n / 10) : n > 16 ? Math.ceil(n / 8) : 1;

  if (max === 0) {
    return (
      <div className={cn("grid place-items-center rounded-xl border border-dashed border-border text-sm text-muted", className)} style={{ height }}>
        {emptyText}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-end" style={{ height, gap }} role="img" aria-label={bars.map((b) => b.tooltip).join("; ")}>
        {bars.map((b, i) => (
          <div
            key={b.key}
            className="group relative flex h-full flex-1 items-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => setHover(hover === i ? null : i)}
          >
            <div
              className="w-full rounded-t-[4px] transition-[height,opacity] duration-500"
              style={{
                height: `${Math.max(b.value > 0 ? 3 : 0, (b.value / max) * 100)}%`,
                backgroundColor: color,
                opacity: hover === null ? (b.highlight ? 1 : 0.75) : hover === i ? 1 : 0.35,
              }}
            />
            {b.value === 0 && <div className="absolute bottom-0 h-[2px] w-full rounded bg-border" />}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex" style={{ gap }}>
        {bars.map((b, i) => (
          <div key={b.key} className={cn("flex-1 overflow-visible whitespace-nowrap text-center text-[10px] text-muted", b.highlight && "font-semibold text-text")}>
            {i % showEvery === 0 ? b.label : ""}
          </div>
        ))}
      </div>
      {hover !== null && bars[hover] && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-text px-2 py-1 text-xs text-bg shadow"
          style={{ left: `${((hover + 0.5) / n) * 100}%` }}
        >
          {bars[hover].tooltip}
        </div>
      )}
    </div>
  );
}

export function HBar({ label, value, max, color, right }: { label: string; value: number; max: number; color: string; right: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          {label}
        </span>
        <span className="tabular text-muted">{right}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full" style={{ width: `${max ? (value / max) * 100 : 0}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
