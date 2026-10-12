"use client";

import { useId, useState } from "react";
import { LineChart as LineIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/domain/stats";
import { useInView } from "@/components/charts/use-in-view";

/** `unit` en vez de una función de formato: las props de un componente cliente deben ser serializables. */
export type LineSeries = { label: string; color: string; values: number[]; unit: "minutes" | "count" | "percent"; dashed?: boolean; area?: boolean };

function fmt(v: number, unit: LineSeries["unit"]): string {
  if (unit === "minutes") return formatDuration(v * 60);
  if (unit === "percent") return `${Math.round(v * 100)} %`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ",");
}

const W = 600;

/**
 * Gráfico de líneas SVG: área con degradado, la línea se "dibuja" al aparecer en pantalla y, al pasar el
 * ratón (o con el teclado), una guía vertical con un punto por serie y un tooltip con todas las series.
 * Cada serie se escala a su propio máximo si `independent`.
 */
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
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const [ref, seen] = useInView<HTMLDivElement>();
  const n = labels.length;
  const globalMax = Math.max(0, ...series.flatMap((s) => s.values));
  if (n < 2 || globalMax === 0) {
    return (
      <div
        className={cn("relative grid place-items-center overflow-hidden rounded-2xl border border-dashed border-border-strong bg-surface/30 px-4 text-center text-sm text-muted", className)}
        style={{ height: Math.max(height, 110) }}
      >
        <div className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(60%_70%_at_50%_50%,#000,transparent)]" aria-hidden />
        <div className="relative flex flex-col items-center gap-2">
          <span className="tone-chip-soft h-9 w-9 rounded-xl [&_svg]:h-4 [&_svg]:w-4" aria-hidden>
            <LineIcon />
          </span>
          {emptyText}
        </div>
      </div>
    );
  }
  const H = height;
  const pad = 8;
  const x = (i: number) => (i / (n - 1)) * W;
  const maxOf = (s: LineSeries) => (independent ? Math.max(...s.values) : globalMax);
  const y = (v: number, max: number) => H - pad - (max ? (v / max) * (H - pad * 2) : 0);
  const path = (s: LineSeries) => {
    const max = maxOf(s);
    return s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v, max).toFixed(1)}`).join(" ");
  };
  const showEvery = Math.ceil(n / 8);
  const hoverPct = hover !== null ? (hover / (n - 1)) * 100 : 0;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <div className="relative" style={{ height }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full overflow-visible" style={{ height }} role="img" aria-label={series.map((s) => s.label).join(", ")}>
          <defs>
            {series.map((s, si) => (
              <linearGradient key={si} id={`${uid}-a${si}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.32} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
            {/* La línea se descubre de izquierda a derecha al entrar en pantalla. */}
            <clipPath id={`${uid}-clip`}>
              <rect
                x={0}
                y={-20}
                width={W}
                height={H + 40}
                style={{ transform: seen ? "scaleX(1)" : "scaleX(0)", transformOrigin: "0 0", transition: "transform 1500ms var(--ease-out)" }}
              />
            </clipPath>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="var(--border)" strokeOpacity={0.7} vectorEffect="non-scaling-stroke" />
          ))}
          <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--border-strong)" vectorEffect="non-scaling-stroke" />
          <g clipPath={`url(#${uid}-clip)`}>
            {series.map((s, si) => (s.area ? <path key={`${s.label}-a`} d={`${path(s)} L${W},${H} L0,${H} Z`} fill={`url(#${uid}-a${si})`} /> : null))}
            {series.map((s) => (
              <path
                key={s.label}
                d={path(s)}
                fill="none"
                stroke={s.color}
                strokeWidth={s.dashed ? 2 : 2.5}
                strokeDasharray={s.dashed ? "5 5" : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                style={s.dashed ? undefined : { filter: `drop-shadow(0 4px 8px color-mix(in srgb, ${s.color} 45%, transparent))` }}
              />
            ))}
          </g>
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="var(--text)" strokeOpacity={0.25} strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        </svg>

        {/* Puntos: en HTML para que no se deformen con el escalado del SVG. Último valor siempre visible. */}
        {series.map((s) => {
          const i = hover ?? n - 1;
          const top = y(s.values[i], maxOf(s));
          return (
            <span
              key={s.label}
              className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface transition-opacity duration-500"
              style={{ left: `${(i / (n - 1)) * 100}%`, top, backgroundColor: s.color, boxShadow: `0 0 0 4px color-mix(in srgb, ${s.color} 20%, transparent)`, opacity: seen ? 1 : 0 }}
              aria-hidden
            />
          );
        })}

        <div className="absolute inset-0 flex">
          {labels.map((l, i) => (
            <div
              key={i}
              className="h-full flex-1 cursor-crosshair"
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

        {hover !== null && (
          <div
            className="pointer-events-none absolute -top-2 z-20"
            style={{ left: `${hoverPct}%`, transform: `translate(${hoverPct < 18 ? "-8%" : hoverPct > 82 ? "-92%" : "-50%"}, -100%)` }}
          >
            <div className="pop-in w-max max-w-[min(280px,80vw)] rounded-xl bg-text px-3 py-2 text-xs text-bg shadow-pop [.card-feature_&]:bg-black/75 [.card-feature_&]:text-white [.card-feature_&]:backdrop-blur">
              <p className="mb-1 text-[10.5px] font-medium opacity-70">{labels[hover]}</p>
              {series.map((s) => (
                <p key={s.label} className="flex items-center gap-2 leading-relaxed">
                  <span className="inline-block w-3 border-t-2" style={{ borderColor: s.color, borderTopStyle: s.dashed ? "dashed" : "solid" }} />
                  <span className="font-semibold tabular">{fmt(s.values[hover], s.unit)}</span>
                  <span className="opacity-70">{s.label}</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Etiquetas del eje X: la primera alineada a la izquierda y la última a la derecha, para que no se salgan. */}
      <div className="relative mt-2 h-4 text-[10.5px] text-muted" aria-hidden>
        {labels.map((l, i) => {
          const last = i === n - 1;
          if (!last && (i % showEvery !== 0 || n - 1 - i < showEvery * 0.6)) return null;
          return (
            <span
              key={i}
              className={cn("absolute top-0 whitespace-nowrap", hover === i && "font-semibold text-text")}
              style={{ left: `${(i / (n - 1)) * 100}%`, transform: i === 0 ? "none" : last ? "translateX(-100%)" : "translateX(-50%)" }}
            >
              {l}
            </span>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-2 rounded-full bg-surface-2/70 px-2.5 py-1 text-[11px] font-medium text-muted">
            <span className="inline-block w-4 border-t-2" style={{ borderColor: s.color, borderTopStyle: s.dashed ? "dashed" : "solid" }} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Mini gráfico de tendencia sin interacción: línea con área en degradado y punto final. `fluid` ocupa todo el ancho. */
export function Sparkline({
  values,
  color = "var(--tone)",
  width = 96,
  height = 28,
  label,
  fluid = false,
  className,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  label: string;
  fluid?: boolean;
  className?: string;
}) {
  const gid = `sp${useId().replace(/:/g, "")}`;
  const max = Math.max(0, ...values);
  if (values.length < 2) return null;
  const px = (i: number) => (i / (values.length - 1)) * width;
  const py = (v: number) => height - 3 - (max ? (v / max) * (height - 6) : 0);
  const pts = values.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`);
  const stroke = max ? color : "var(--border-strong)";
  const last = values.length - 1;
  return (
    <svg
      width={fluid ? "100%" : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={fluid ? "none" : undefined}
      className={cn("block overflow-visible", className)}
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      {max > 0 && <polygon points={`0,${height} ${pts.join(" ")} ${width},${height}`} fill={`url(#${gid})`} />}
      <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {!fluid && max > 0 && <circle cx={px(last)} cy={py(values[last])} r={3} fill={color} stroke="var(--surface)" strokeWidth={1.5} />}
    </svg>
  );
}
