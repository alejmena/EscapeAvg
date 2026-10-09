import { diffDays, type ISODate, toDate } from "@/lib/domain/dates";

const dayFmt = new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const shortFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", timeZone: "UTC" });
const longFmt = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export function formatDue(date: ISODate, today: ISODate): { label: string; tone: "overdue" | "today" | "soon" | "later" } {
  const diff = diffDays(date, today);
  if (diff < 0) return { label: diff === -1 ? "Ayer" : shortFmt.format(toDate(date)), tone: "overdue" };
  if (diff === 0) return { label: "Hoy", tone: "today" };
  if (diff === 1) return { label: "Mañana", tone: "soon" };
  if (diff < 7) return { label: dayFmt.format(toDate(date)), tone: "soon" };
  return { label: shortFmt.format(toDate(date)), tone: "later" };
}

export function formatShortDate(date: ISODate): string {
  return shortFmt.format(toDate(date));
}

export function formatLongDate(date: ISODate): string {
  const s = longFmt.format(toDate(date));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function greeting(hour: number): string {
  if (hour < 6) return "Buenas noches";
  if (hour < 13) return "Buenos días";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

export const PRIORITY_LABEL = ["Sin prioridad", "Baja", "Media", "Alta"] as const;
export const PRIORITY_COLOR = ["", "#0ea5e9", "#f59e0b", "#ef4444"] as const;
export const WEEKDAY_SHORT = ["D", "L", "M", "X", "J", "V", "S"] as const;
export const WEEKDAY_NAME = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;
