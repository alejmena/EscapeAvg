"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { calendarHeatmap, DAY_METRIC_LABEL, type DayMetric, type HeatCell } from "@/lib/domain/analytics";
import { type DailyStat, formatDuration } from "@/lib/domain/stats";
import { formatShortDate, WEEKDAY_SHORT } from "@/lib/format";
import type { Tone } from "@/lib/sections";
import { cn } from "@/lib/cn";
import { levelBackground } from "@/components/charts/colors";
import { useInView } from "@/components/charts/use-in-view";

/** Cada métrica con su tono: concentración y actividad usan el de la página; tareas en verde y hábitos en naranja. */
const METRIC_TONE: Record<DayMetric, Tone | undefined> = {
  focus: undefined,
  tasks: "green",
  habits: "orange",
  active: undefined,
};
const monthFmt = new Intl.DateTimeFormat("es", { month: "short", timeZone: "UTC" });

function describe(cell: HeatCell, metric: DayMetric, d?: DailyStat): string {
  const date = formatShortDate(cell.day);
  if (!d) return `${date}: sin actividad`;
  if (metric === "focus") return `${date}: ${d.focus_seconds ? formatDuration(d.focus_seconds) : "sin"} concentración`;
  if (metric === "tasks") return `${date}: ${d.tasks_completed} ${d.tasks_completed === 1 ? "tarea" : "tareas"}`;
  if (metric === "habits") return `${date}: ${d.habits_done} ${d.habits_done === 1 ? "hábito" : "hábitos"}`;
  return `${date}: ${formatDuration(d.focus_seconds)} · ${d.tasks_completed} tareas · ${d.habits_done} hábitos`;
}

/**
 * Calendario de actividad estilo GitHub. Cada celda es un día; la intensidad es relativa a tu propio
 * historial (cuartiles). Al tocar un día se abren sus estadísticas.
 */
export function CalendarHeatmap({
  days,
  from,
  to,
  weekStartsOn,
  metrics = ["focus", "tasks", "habits", "active"],
  compact = false,
}: {
  days: DailyStat[];
  from: string;
  to: string;
  weekStartsOn: number;
  metrics?: DayMetric[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [metric, setMetric] = useState<DayMetric>(metrics[0]);
  const [hover, setHover] = useState<HeatCell | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [view, seen] = useInView<HTMLDivElement>();
  const map = useMemo(() => calendarHeatmap(days, metric, from, to, weekStartsOn), [days, metric, from, to, weekStartsOn]);
  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);
  const gap = 3;
  const [cell, setCell] = useState(compact ? 12 : 13);
  const weeksCount = map.weeks.length;

  useEffect(() => {
    // Celdas que llenan el ancho disponible (entre 11 y 26 px); si no caben, desplazamiento horizontal
    // mostrando primero las semanas más recientes.
    const el = scroller.current;
    if (!el) return;
    const fit = () => {
      const available = el.clientWidth - 30;
      setCell(Math.max(11, Math.min(compact ? 18 : 26, Math.floor(available / weeksCount) - gap)));
      el.scrollLeft = el.scrollWidth;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [weeksCount, compact]);

  const rowLabels = Array.from({ length: 7 }, (_, i) => WEEKDAY_SHORT[(weekStartsOn + i) % 7]);
  // Evita etiquetas de mes solapadas.
  const monthLabels = map.months.filter((m, i, arr) => i === 0 || m.week - arr[i - 1].week >= 3);
  const radius = cell >= 18 ? 5 : cell >= 14 ? 4 : 3;

  const summary =
    metric === "focus"
      ? `${formatDuration(map.total * 60)} en ${map.activeDays} días`
      : metric === "tasks"
        ? `${map.total} tareas en ${map.activeDays} días`
        : metric === "habits"
          ? `${map.total} hábitos cumplidos en ${map.activeDays} días`
          : `${map.activeDays} días con actividad`;

  return (
    <div ref={view} data-tone={METRIC_TONE[metric]}>
      {metrics.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="max-w-full overflow-x-auto">
            <div className="seg" role="tablist" aria-label="Métrica del calendario">
              {metrics.map((m) => (
                <button key={m} type="button" role="tab" aria-selected={metric === m} onClick={() => setMetric(m)} className="press">
                  {DAY_METRIC_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-tone-soft px-3 py-1 text-xs font-semibold text-tone-ink transition-colors">
            <span className="h-1.5 w-1.5 rounded-full bg-tone" aria-hidden />
            {summary}
          </p>
        </div>
      )}
      <div className="relative">
        <div ref={scroller} className="overflow-x-auto pb-1">
          <div className={cn("flex w-max gap-2", !compact && "mx-auto")}>
            <div className="flex flex-col pt-[20px] text-[10px] font-medium text-faint" style={{ gap }} aria-hidden>
              {rowLabels.map((l, i) => (
                <span key={i} className="leading-none" style={{ height: cell, lineHeight: `${cell}px` }}>
                  {i % 2 === 0 ? l : ""}
                </span>
              ))}
            </div>
            <div>
              <div className="relative mb-1.5 h-[14px] text-[10px] font-medium capitalize text-muted" aria-hidden>
                {monthLabels.map((m) => (
                  <span key={m.month} className="absolute" style={{ left: m.week * (cell + gap) }}>
                    {monthFmt.format(new Date(`${m.month}T00:00:00Z`))}
                  </span>
                ))}
              </div>
              <div className="flex" style={{ gap }} role="group" aria-label={`Calendario de ${DAY_METRIC_LABEL[metric].toLowerCase()}`}>
                {map.weeks.map((week, wi) => (
                  <div
                    key={wi}
                    className="flex flex-col"
                    style={{
                      gap,
                      opacity: seen ? 1 : 0,
                      transform: seen ? "none" : "translateY(6px)",
                      transition: `opacity 500ms ease ${wi * 14}ms, transform 600ms var(--ease-out) ${wi * 14}ms`,
                    }}
                  >
                    {week.map((c) =>
                      c.inRange ? (
                        <button
                          key={c.day}
                          type="button"
                          aria-label={describe(c, metric, byDay.get(c.day))}
                          onMouseEnter={() => setHover(c)}
                          onMouseLeave={() => setHover(null)}
                          onFocus={() => setHover(c)}
                          onBlur={() => setHover(null)}
                          onClick={() => router.push(`/stats?range=custom&from=${c.day}&to=${c.day}`)}
                          className={cn(
                            "relative transition-[transform,box-shadow,background] duration-200 hover:z-10 hover:scale-[1.35] hover:shadow-[0_4px_12px_-2px_var(--tone)] focus-visible:z-10",
                            c.day === to && "ring-2 ring-tone ring-offset-1 ring-offset-surface",
                          )}
                          style={{
                            width: cell,
                            height: cell,
                            borderRadius: radius,
                            background: levelBackground(c.level, "var(--tone)", "var(--tone-2)"),
                            boxShadow: c.level >= 4 ? "0 2px 8px -3px var(--tone)" : undefined,
                          }}
                        />
                      ) : (
                        <span key={c.day} style={{ width: cell, height: cell }} />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
          <span aria-live="polite" className="inline-flex min-h-[22px] items-center gap-1.5">
            {hover ? (
              <>
                <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: levelBackground(hover.level, "var(--tone)", "var(--tone-2)") }} aria-hidden />
                <span className="font-semibold text-text">{describe(hover, metric, byDay.get(hover.day))}</span>
              </>
            ) : (
              "Toca un día para ver su detalle"
            )}
          </span>
          <span className="flex items-center gap-1" aria-hidden>
            Menos
            {[0, 1, 2, 3, 4].map((l) => (
              <span key={l} className="inline-block rounded-[3px]" style={{ width: 11, height: 11, background: levelBackground(l, "var(--tone)", "var(--tone-2)") }} />
            ))}
            Más
          </span>
        </div>
      </div>
    </div>
  );
}
