import { localDate, weekday, type ISODate } from "./dates";
import type { QuickTask, QuickTemplate } from "@/lib/types";

/** Texto discreto del contador: "2 de 5 completadas". */
export function quickCounter(tasks: Pick<QuickTask, "status">[]): string {
  const done = tasks.filter((t) => t.status === "done").length;
  return `${done} de ${tasks.length} ${tasks.length === 1 ? "completada" : "completadas"}`;
}

/**
 * Lo que se ve hoy: las pendientes (de hoy o anteriores si se conservan) y las completadas hoy.
 * Las de días pasados ya completadas pasan al historial.
 */
export function visibleToday(tasks: QuickTask[], today: ISODate, tz: string, carryOver: boolean): QuickTask[] {
  return tasks
    .filter((t) => {
      if (t.status === "archived") return false;
      if (t.status === "done") return !!t.completed_at && localDate(new Date(t.completed_at), tz) === today;
      if (!t.due_date || t.due_date === today) return true;
      return carryOver && t.due_date < today;
    })
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

/** Plantillas recurrentes que tocan hoy y aún no se han creado hoy. */
export function templatesDueToday(templates: QuickTemplate[], today: ISODate, createdToday: Set<string>): QuickTemplate[] {
  const wd = weekday(today);
  return templates.filter((t) => t.repeat_days.includes(wd) && !createdToday.has(t.id));
}

/** Mueve un elemento de `from` a `to` y devuelve el nuevo orden. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}

export type HistoryDay = { day: ISODate; titles: string[] };

/** Completadas agrupadas por día local, del más reciente al más antiguo. */
export function groupHistory(tasks: Pick<QuickTask, "title" | "completed_at">[], tz: string): HistoryDay[] {
  const map = new Map<ISODate, string[]>();
  for (const t of tasks) {
    if (!t.completed_at) continue;
    const day = localDate(new Date(t.completed_at), tz);
    map.set(day, [...(map.get(day) ?? []), t.title]);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([day, titles]) => ({ day, titles }));
}

/** Texto corto de los días de repetición: "Todos los días", "Lun a vie", "L · X · V". */
export function describeRepeat(days: number[]): string {
  const set = new Set(days);
  if (set.size === 0) return "Plantilla";
  if (set.size === 7) return "Todos los días";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return "Lun a vie";
  if (set.size === 2 && set.has(0) && set.has(6)) return "Fines de semana";
  const short = ["D", "L", "M", "X", "J", "V", "S"];
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => set.has(d)).map((d) => short[d]).join(" · ");
}
