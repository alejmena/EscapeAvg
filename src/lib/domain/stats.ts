import { addDays, diffDays, endOfMonth, type ISODate, startOfMonth, startOfWeek } from "./dates";

export type DailyStat = {
  day: ISODate;
  focus_seconds: number;
  focus_sessions: number;
  interruptions: number;
  tasks_completed: number;
  habits_done: number;
};

export type Totals = Omit<DailyStat, "day"> & { active_days: number; days: number };

/** Un día es "activo" si hubo actividad real mínima: ≥1 min de concentración, una tarea o un hábito. */
export function isActiveDay(d: DailyStat): boolean {
  return d.focus_seconds >= 60 || d.tasks_completed > 0 || d.habits_done > 0;
}

export function totals(days: DailyStat[]): Totals {
  return days.reduce<Totals>(
    (acc, d) => ({
      focus_seconds: acc.focus_seconds + Number(d.focus_seconds),
      focus_sessions: acc.focus_sessions + d.focus_sessions,
      interruptions: acc.interruptions + d.interruptions,
      tasks_completed: acc.tasks_completed + d.tasks_completed,
      habits_done: acc.habits_done + d.habits_done,
      active_days: acc.active_days + (isActiveDay(d) ? 1 : 0),
      days: acc.days + 1,
    }),
    { focus_seconds: 0, focus_sessions: 0, interruptions: 0, tasks_completed: 0, habits_done: 0, active_days: 0, days: 0 },
  );
}

export type Comparison = {
  current: number;
  previous: number;
  delta: number;
  /** Variación relativa (0.25 = +25 %). null si el período anterior no tiene datos: no inventamos porcentajes. */
  pct: number | null;
  trend: "up" | "down" | "flat";
};

export function compare(current: number, previous: number): Comparison {
  const delta = current - previous;
  const pct = previous > 0 ? delta / previous : null;
  const trend = delta === 0 ? "flat" : delta > 0 ? "up" : "down";
  return { current, previous, delta, pct, trend };
}

export type PeriodKind = "day" | "week" | "month";
export type Range = { from: ISODate; to: ISODate };

/**
 * Rango actual y anterior comparables. Para semana y mes en curso, el anterior se recorta
 * al mismo número de días transcurridos (comparar lunes–miércoles con lunes–miércoles es justo;
 * con la semana anterior completa no lo sería).
 */
export function periodRanges(kind: PeriodKind, today: ISODate, weekStartsOn = 1): { current: Range; previous: Range } {
  if (kind === "day") {
    const y = addDays(today, -1);
    return { current: { from: today, to: today }, previous: { from: y, to: y } };
  }
  if (kind === "week") {
    const from = startOfWeek(today, weekStartsOn);
    const elapsed = diffDays(today, from);
    const pFrom = addDays(from, -7);
    return { current: { from, to: today }, previous: { from: pFrom, to: addDays(pFrom, elapsed) } };
  }
  const from = startOfMonth(today);
  const elapsed = diffDays(today, from);
  const pFrom = startOfMonth(addDays(from, -1));
  const pEnd = endOfMonth(pFrom);
  const pTo = addDays(pFrom, elapsed) > pEnd ? pEnd : addDays(pFrom, elapsed);
  return { current: { from, to: today }, previous: { from: pFrom, to: pTo } };
}

/** Rango anterior de la misma longitud que [from, to] (para rangos personalizados). */
export function previousRange(range: Range): Range {
  const len = diffDays(range.to, range.from) + 1;
  return { from: addDays(range.from, -len), to: addDays(range.from, -1) };
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return s > 0 && m === 0 ? "<1 min" : `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatPct(pct: number): string {
  const v = Math.round(pct * 100);
  return `${v > 0 ? "+" : ""}${v} %`;
}

/** Frase honesta de comparación, p. ej. "un 25 % más que la semana anterior". */
export function describeChange(c: Comparison, previousLabel: string): string {
  if (c.current === 0 && c.previous === 0) return `Sin actividad registrada ni ${previousLabel}`;
  if (c.pct === null) return `Sin datos ${previousLabel} para comparar`;
  if (c.trend === "flat") return `Igual que ${previousLabel}`;
  const v = Math.abs(Math.round(c.pct * 100));
  return `Un ${v} % ${c.trend === "up" ? "más" : "menos"} que ${previousLabel}`;
}

/** Precisión de estimaciones: tiempo real / estimado de tareas completadas con ambos datos. */
export function estimateAccuracy(
  tasks: { estimated_minutes: number | null; actual_seconds: number }[],
): { ratio: number; sample: number } | null {
  const valid = tasks.filter((t) => t.estimated_minutes && t.actual_seconds >= 60);
  if (valid.length === 0) return null;
  const est = valid.reduce((a, t) => a + (t.estimated_minutes as number) * 60, 0);
  const act = valid.reduce((a, t) => a + t.actual_seconds, 0);
  return { ratio: act / est, sample: valid.length };
}
