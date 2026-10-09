import { addDays, addMonths, type ISODate, weekday } from "./dates";

export type RecurrenceRule = {
  freq: "daily" | "weekly" | "monthly";
  /** Cada cuántas unidades (días, semanas, meses). */
  interval: number;
  /** Solo para weekly: días concretos (0 = domingo … 6 = sábado). */
  weekdays?: number[];
};

/**
 * Siguiente fecha de una tarea recurrente a partir de `from` (su fecha límite actual,
 * o la fecha en que se completó si no tenía). Siempre devuelve una fecha estrictamente posterior.
 */
export function nextOccurrence(rule: RecurrenceRule, from: ISODate): ISODate {
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  switch (rule.freq) {
    case "daily":
      return addDays(from, interval);
    case "monthly":
      return addMonths(from, interval);
    case "weekly": {
      const days = [...new Set(rule.weekdays ?? [])].filter((d) => d >= 0 && d <= 6).sort();
      if (days.length === 0) return addDays(from, 7 * interval);
      const current = weekday(from);
      // ¿Queda algún día marcado en esta misma semana (lunes–domingo relativo a `from`)?
      const later = days.find((d) => d > current);
      if (later !== undefined) return addDays(from, later - current);
      // Si no, el primer día marcado de la semana que toca según el intervalo.
      const toNextWeekStart = 7 - current; // hasta el domingo siguiente
      return addDays(from, toNextWeekStart + 7 * (interval - 1) + days[0]);
    }
  }
}

export function describeRecurrence(rule: RecurrenceRule | null | undefined): string | null {
  if (!rule) return null;
  const n = Math.max(1, rule.interval || 1);
  const names = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  switch (rule.freq) {
    case "daily":
      return n === 1 ? "Cada día" : `Cada ${n} días`;
    case "monthly":
      return n === 1 ? "Cada mes" : `Cada ${n} meses`;
    case "weekly": {
      const base = n === 1 ? "Cada semana" : `Cada ${n} semanas`;
      const days = (rule.weekdays ?? []).slice().sort().map((d) => names[d]);
      return days.length ? `${base} (${days.join(", ")})` : base;
    }
  }
}
