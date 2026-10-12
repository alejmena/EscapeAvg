"use client";

import { useState } from "react";
import { Grid3x3, Zap } from "lucide-react";
import { formatDuration } from "@/lib/domain/stats";
import { WEEKDAY_NAME, WEEKDAY_SHORT } from "@/lib/format";
import { cn } from "@/lib/cn";
import { levelBackground } from "@/components/charts/colors";
import { useInView } from "@/components/charts/use-in-view";

export type HourMatrixOption = { key: string; label: string; color: string; seconds: number[][]; sessions: number[][] };

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/**
 * Mapa de calor día de la semana × hora de inicio. Intensidad relativa al máximo de la selección.
 * Encima, una fila de mini barras con el total de cada hora; debajo, la lectura de la celda señalada.
 */
export function HourHeatmap({ options, weekStartsOn }: { options: HourMatrixOption[]; weekStartsOn: number }) {
  const [key, setKey] = useState(options[0]?.key);
  const [hover, setHover] = useState<{ w: number; h: number } | null>(null);
  const [ref, seen] = useInView<HTMLDivElement>();
  const opt = options.find((o) => o.key === key) ?? options[0];
  if (!opt) return null;
  const max = Math.max(0, ...opt.seconds.flat());
  const level = (v: number) => (v <= 0 || max === 0 ? 0 : Math.max(1, Math.ceil((v / max) * 4)));
  const rows = Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
  const label = (w: number, h: number) =>
    `${WEEKDAY_NAME[w]} ${h}:00–${h + 1}:00 · ${formatDuration(opt.seconds[w][h])} en ${opt.sessions[w][h]} ${opt.sessions[w][h] === 1 ? "sesión" : "sesiones"}`;
  // El "tono" de la selección: la categoría elegida o el de la página.
  const color = opt.color;
  const color2 = opt.key === "all" ? "var(--tone-2)" : undefined;
  const byHour = HOURS.map((h) => rows.reduce((a, w) => a + opt.seconds[w][h], 0));
  const maxHour = Math.max(0, ...byHour);
  const peakHour = maxHour > 0 ? byHour.indexOf(maxHour) : null;

  return (
    <div ref={ref}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {options.length > 1 ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por categoría">
            {options.map((o) => {
              const active = o.key === opt.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setKey(o.key)}
                  className={cn(
                    "press inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[12.5px] font-medium",
                    active ? "border-transparent bg-text text-bg shadow-float" : "border-border bg-surface/70 text-muted hover:border-border-strong hover:text-text",
                  )}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: o.color, boxShadow: active ? `0 0 0 3px color-mix(in srgb, ${o.color} 35%, transparent)` : undefined }} aria-hidden />
                  {o.label}
                </button>
              );
            })}
          </div>
        ) : (
          <span />
        )}
        {peakHour !== null && (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-tone-soft px-3 py-1 text-xs font-semibold text-tone-ink">
            <Zap size={13} aria-hidden />
            Hora pico: {peakHour}:00–{peakHour + 1}:00
          </p>
        )}
      </div>
      {max === 0 ? (
        <div className="relative grid h-44 place-items-center overflow-hidden rounded-2xl border border-dashed border-border-strong bg-surface/30 text-sm text-muted">
          <div className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(60%_70%_at_50%_50%,#000,transparent)]" aria-hidden />
          <div className="relative flex flex-col items-center gap-2">
            <span className="tone-chip-soft h-9 w-9 rounded-xl [&_svg]:h-4 [&_svg]:w-4" aria-hidden>
              <Grid3x3 />
            </span>
            Sin sesiones en este período
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto pb-1">
            <table className="w-full min-w-[560px] table-fixed border-separate" style={{ borderSpacing: 3 }} aria-label="Concentración por día y hora">
              <thead>
                {/* Total por hora: mini barras alineadas con las columnas. */}
                <tr aria-hidden>
                  <td className="w-8" />
                  {HOURS.map((h) => (
                    <td key={h} className="h-9 p-0 align-bottom">
                      <div
                        className="mx-auto w-full max-w-[18px] rounded-t-[3px]"
                        style={{
                          height: maxHour ? Math.max(byHour[h] ? 3 : 0, (byHour[h] / maxHour) * 30) : 0,
                          background: `linear-gradient(0deg, color-mix(in srgb, ${color} 35%, transparent), ${color})`,
                          opacity: hover && hover.h !== h ? 0.35 : 1,
                          transformOrigin: "bottom",
                          transform: seen ? "scaleY(1)" : "scaleY(0)",
                          transition: `transform 800ms var(--ease-out) ${h * 18}ms, opacity 200ms ease`,
                        }}
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th className="w-8" />
                  {HOURS.map((h) => (
                    <th key={h} scope="col" className={cn("pt-1 text-center text-[10px] font-medium text-faint tabular", hover?.h === h && "text-text")}>
                      {h % 3 === 0 ? h : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w}>
                    <th scope="row" className={cn("pr-1 text-left text-[11px] font-medium text-muted", hover?.w === w && "text-text")}>
                      {WEEKDAY_SHORT[w]}
                    </th>
                    {HOURS.map((h) => {
                      const lv = level(opt.seconds[w][h]);
                      return (
                        <td
                          key={h}
                          tabIndex={opt.sessions[w][h] ? 0 : -1}
                          aria-label={label(w, h)}
                          onMouseEnter={() => setHover({ w, h })}
                          onMouseLeave={() => setHover(null)}
                          onFocus={() => setHover({ w, h })}
                          onBlur={() => setHover(null)}
                          onClick={() => setHover({ w, h })}
                          className={cn(
                            "h-[22px] cursor-pointer rounded-[5px] p-0 hover:scale-[1.25] sm:h-[26px]",
                            hover && hover.w === w && hover.h === h && "relative z-10 shadow-[0_6px_14px_-4px_var(--tone)]",
                          )}
                          style={{
                            background: levelBackground(lv, color, color2),
                            opacity: seen ? 1 : 0,
                            transition: `opacity 500ms ease ${h * 14}ms, transform 200ms var(--ease-out), box-shadow 200ms ease`,
                          }}
                        />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
            <p className="inline-flex min-h-[22px] items-center gap-1.5" aria-live="polite">
              {hover ? (
                <>
                  <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: levelBackground(level(opt.seconds[hover.w][hover.h]), color, color2) }} aria-hidden />
                  <span className="font-semibold text-text">{label(hover.w, hover.h)}</span>
                </>
              ) : (
                "Según la hora de inicio de cada sesión completada."
              )}
            </p>
            <span className="flex items-center gap-1" aria-hidden>
              Menos
              {[0, 1, 2, 3, 4].map((l) => (
                <span key={l} className="inline-block rounded-[3px]" style={{ width: 11, height: 11, background: levelBackground(l, color, color2) }} />
              ))}
              Más
            </span>
          </div>
        </>
      )}
    </div>
  );
}
