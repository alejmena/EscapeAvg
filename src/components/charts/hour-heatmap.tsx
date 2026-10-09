"use client";

import { useState } from "react";
import { formatDuration } from "@/lib/domain/stats";
import { WEEKDAY_NAME, WEEKDAY_SHORT } from "@/lib/format";
import { levelColor } from "@/components/charts/colors";
import { Select } from "@/components/ui/form";

export type HourMatrixOption = { key: string; label: string; color: string; seconds: number[][]; sessions: number[][] };

/** Mapa de calor día de la semana × hora de inicio. Intensidad relativa al máximo de la selección. */
export function HourHeatmap({ options, weekStartsOn }: { options: HourMatrixOption[]; weekStartsOn: number }) {
  const [key, setKey] = useState(options[0]?.key);
  const [hover, setHover] = useState<{ w: number; h: number } | null>(null);
  const opt = options.find((o) => o.key === key) ?? options[0];
  if (!opt) return null;
  const max = Math.max(0, ...opt.seconds.flat());
  const level = (v: number) => (v <= 0 || max === 0 ? 0 : Math.max(1, Math.ceil((v / max) * 4)));
  const rows = Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
  const label = (w: number, h: number) =>
    `${WEEKDAY_NAME[w]} ${h}:00–${h + 1}:00 · ${formatDuration(opt.seconds[w][h])} en ${opt.sessions[w][h]} ${opt.sessions[w][h] === 1 ? "sesión" : "sesiones"}`;

  return (
    <div>
      {options.length > 1 && (
        <div className="mb-3">
          <Select value={key} onChange={(e) => setKey(e.target.value)} aria-label="Filtrar por categoría" className="h-9 w-auto">
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      )}
      {max === 0 ? (
        <div className="grid h-40 place-items-center rounded-xl border border-dashed border-border text-sm text-muted">Sin sesiones en este período</div>
      ) : (
        <>
          <div className="overflow-x-auto pb-1">
            <table className="border-separate" style={{ borderSpacing: 2 }} aria-label="Concentración por día y hora">
              <thead>
                <tr>
                  <th />
                  {Array.from({ length: 24 }, (_, h) => (
                    <th key={h} scope="col" className="w-[18px] text-center text-[10px] font-normal text-muted">
                      {h % 3 === 0 ? h : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w}>
                    <th scope="row" className="pr-1 text-left text-[10px] font-normal text-muted">
                      {WEEKDAY_SHORT[w]}
                    </th>
                    {Array.from({ length: 24 }, (_, h) => (
                      <td
                        key={h}
                        tabIndex={opt.sessions[w][h] ? 0 : -1}
                        aria-label={label(w, h)}
                        onMouseEnter={() => setHover({ w, h })}
                        onMouseLeave={() => setHover(null)}
                        onFocus={() => setHover({ w, h })}
                        onBlur={() => setHover(null)}
                        onClick={() => setHover({ w, h })}
                        className="h-[18px] w-[18px] min-w-[14px] rounded-[3px]"
                        style={{ backgroundColor: levelColor(level(opt.seconds[w][h]), opt.color) }}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 min-h-[1em] text-[11px] text-muted" aria-live="polite">
            {hover ? label(hover.w, hover.h) : "Según la hora de inicio de cada sesión completada."}
          </p>
        </>
      )}
    </div>
  );
}
