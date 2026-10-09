"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { calendarHeatmap, DAY_METRIC_LABEL, type DayMetric, type HeatCell } from "@/lib/domain/analytics";
import { type DailyStat, formatDuration } from "@/lib/domain/stats";
import { formatShortDate, WEEKDAY_SHORT } from "@/lib/format";
import { cn } from "@/lib/cn";
import { levelColor } from "@/components/charts/colors";

const METRIC_COLOR: Record<DayMetric, string> = {
  focus: "var(--accent)",
  tasks: "var(--success)",
  habits: "var(--warning)",
  active: "var(--accent)",
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
  const map = useMemo(() => calendarHeatmap(days, metric, from, to, weekStartsOn), [days, metric, from, to, weekStartsOn]);
  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);
  const color = METRIC_COLOR[metric];
  const gap = 3;
  const [cell, setCell] = useState(compact ? 12 : 13);
  const weeksCount = map.weeks.length;

  useEffect(() => {
    // Celdas que llenan el ancho disponible (entre 11 y 22 px); si no caben, desplazamiento horizontal
    // mostrando primero las semanas más recientes.
    const el = scroller.current;
    if (!el) return;
    const fit = () => {
      const available = el.clientWidth - 28;
      setCell(Math.max(11, Math.min(compact ? 18 : 22, Math.floor(available / weeksCount) - gap)));
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

  const summary =
    metric === "focus"
      ? `${formatDuration(map.total * 60)} en ${map.activeDays} días`
      : metric === "tasks"
        ? `${map.total} tareas en ${map.activeDays} días`
        : metric === "habits"
          ? `${map.total} hábitos cumplidos en ${map.activeDays} días`
          : `${map.activeDays} días con actividad`;

  return (
    <div>
      {metrics.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap rounded-xl border border-border bg-surface p-1" role="tablist" aria-label="Métrica del calendario">
            {metrics.map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={metric === m}
                onClick={() => setMetric(m)}
                className={cn("rounded-lg px-2.5 py-1 text-xs", metric === m ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-text")}
              >
                {DAY_METRIC_LABEL[m]}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">{summary}</p>
        </div>
      )}
      <div className="relative">
        <div ref={scroller} className="overflow-x-auto pb-1">
          <div className="inline-flex gap-2">
            <div className="flex flex-col pt-[18px] text-[10px] text-muted" style={{ gap }} aria-hidden>
              {rowLabels.map((l, i) => (
                <span key={i} className="leading-none" style={{ height: cell, lineHeight: `${cell}px` }}>
                  {i % 2 === 0 ? l : ""}
                </span>
              ))}
            </div>
            <div>
              <div className="relative mb-1 h-[14px] text-[10px] text-muted" aria-hidden>
                {monthLabels.map((m) => (
                  <span key={m.month} className="absolute" style={{ left: m.week * (cell + gap) }}>
                    {monthFmt.format(new Date(`${m.month}T00:00:00Z`))}
                  </span>
                ))}
              </div>
              <div className="flex" style={{ gap }} role="group" aria-label={`Calendario de ${DAY_METRIC_LABEL[metric].toLowerCase()}`}>
                {map.weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col" style={{ gap }}>
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
                          className={cn("rounded-[3px] transition-transform hover:scale-125", c.day === to && "ring-1 ring-text/40")}
                          style={{ width: cell, height: cell, backgroundColor: levelColor(c.level, color) }}
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
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
          <span aria-live="polite" className="min-h-[1em]">
            {hover ? describe(hover, metric, byDay.get(hover.day)) : "Toca un día para ver su detalle"}
          </span>
          <span className="flex items-center gap-1" aria-hidden>
            Menos
            {[0, 1, 2, 3, 4].map((l) => (
              <span key={l} className="inline-block rounded-[3px]" style={{ width: 10, height: 10, backgroundColor: levelColor(l, color) }} />
            ))}
            Más
          </span>
        </div>
      </div>
    </div>
  );
}
