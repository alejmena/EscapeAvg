import type { ScheduleBlock } from "@/lib/types";

/** Orden de la semana para mostrar: lunes primero (0 = domingo). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** "18:30" → 1110. Devuelve null si no es una hora válida. "24:00" se acepta como fin del día. */
export function parseTime(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

/** 1110 → "18:30". */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type Span = Pick<ScheduleBlock, "day_of_week" | "start_minute" | "end_minute">;

/** Primer bloque que se solapa con `c` el mismo día (ignorando el bloque `ignoreId`). */
export function findOverlap<T extends Span & { id?: string }>(blocks: T[], c: Span, ignoreId?: string): T | null {
  return (
    blocks.find(
      (b) => b.id !== ignoreId && b.day_of_week === c.day_of_week && b.start_minute < c.end_minute && c.start_minute < b.end_minute,
    ) ?? null
  );
}

/** Minutos semanales reservados (opcionalmente solo los de una idea). */
export function weeklyMinutes(blocks: (Span & { idea_key?: string | null })[], ideaKey?: string): number {
  return blocks.filter((b) => !ideaKey || b.idea_key === ideaKey).reduce((acc, b) => acc + (b.end_minute - b.start_minute), 0);
}

/** Semanas para completar `hours` dedicando `minutesPerWeek`. Null si no hay tiempo reservado. */
export function weeksToFinish(hours: number, minutesPerWeek: number): number | null {
  if (minutesPerWeek <= 0) return null;
  return Math.ceil((hours * 60) / minutesPerWeek);
}

/** Rango visible del horario: de la primera a la última hora con bloques, mínimo 8:00–20:00. */
export function visibleRange(blocks: Span[]): { from: number; to: number } {
  let from = 8 * 60;
  let to = 20 * 60;
  for (const b of blocks) {
    from = Math.min(from, Math.floor(b.start_minute / 60) * 60);
    to = Math.max(to, Math.ceil(b.end_minute / 60) * 60);
  }
  return { from, to };
}
