"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/domain/stats";

/** `unit` en vez de una función de formato: las props de un componente cliente deben ser serializables. */
export type LineSeries = { label: string; color: string; values: number[]; unit: "minutes" | "count" | "percent"; dashed?: boolean; area?: boolean };

function fmt(v: number, unit: LineSeries["unit"]): string {
  if (unit === "minutes") return formatDuration(v * 60);
  if (unit === "percent") return `${Math.round(v * 100)} %`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ",");
}

const W = 600;

/** Gráfico de líneas SVG con tooltip por punto (ratón, tacto o teclado). Cada serie se escala a su propio máximo si `independent`. */
export function LineChart({
  series,
  labels,
  height = 160,
  independent = false,
  className,
  emptyText = "Sin datos en este período",
}: {
  series: LineSeries[];
  labels: string[];
  height?: number;
  independent?: boolean;
  className?: string;
  emptyText?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const globalMax = Math.max(0, ...series.flatMap((s) => s.values));
  if (n < 2 || globalMax === 0) {
    return (
      <div className={cn("grid place-items-center rounded-xl border border-dashed border-border text-sm text-muted", className)} style={{ height }}>
        {emptyText}
      </div>
    );
  }
  const H = height;
  const pad = 6;
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number, max: number) => H - pad - (max ? (v / max) * (H - pad * 2) : 0);
  const path = (s: LineSeries) => {
    const max = independent ? Math.max(...s.values) : globalMax;
    return s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v, max).toFixed(1)}`).join(" ");
  };
  const showEvery = Math.ceil(n / 8);

  return (
    <div className={cn("relative", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full" style={{ height }} role="img" aria-label={series.map((s) => s.label).join(", ")}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="var(--border)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
        ))}
        {series.map((s) =>
          s.area ? <path key={`${s.label}-a`} d={`${path(s)} L${W},${H} L0,${H} Z`} fill={s.color} opacity={0.1} /> : null,
        )}
        {series.map((s) => (
          <path
            key={s.label}
            d={path(s)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dashed ? "5 5" : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="var(--muted)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="absolute inset-0 flex" style={{ height }}>
        {labels.map((l, i) => (
          <div
            key={i}
            className="h-full flex-1"
            tabIndex={i === n - 1 ? 0 : -1}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onClick={() => setHover(hover === i ? null : i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n - 1) - 1));
              if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? 0) + 1));
            }}
            aria-label={`${l}: ${series.map((s) => `${s.label} ${fmt(s.values[i], s.unit)}`).join(", ")}`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted" aria-hidden>
        {labels.map((l, i) => (
          <span key={i} className="min-w-0 flex-1 whitespace-nowrap text-center">
            {i % showEvery === 0 || i === n - 1 ? l : ""}
          </span>
        ))}
      </div>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-lg bg-text px-2 py-1 text-xs text-bg shadow"
          style={{ left: `${Math.min(80, Math.max(0, (hover / (n - 1)) * 100 - 10))}%` }}
        >
          <p className="font-medium">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.label} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}: {fmt(s.values[hover], s.unit)}
            </p>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: s.color, opacity: s.dashed ? 0.6 : 1 }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Mini gráfico de tendencia sin interacción (se puede renderizar en servidor). */
export function Sparkline({ values, color = "var(--accent)", width = 96, height = 28, label }: { values: number[]; color?: string; width?: number; height?: number; label: string }) {
  const max = Math.max(0, ...values);
  if (values.length < 2) return null;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - (max ? (v / max) * (height - 4) : 0)).toFixed(1)}`);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <polyline points={pts.join(" ")} fill="none" stroke={max ? color : "var(--border)"} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
