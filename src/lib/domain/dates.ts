/**
 * Utilidades de fechas "locales" representadas como cadenas ISO `YYYY-MM-DD`.
 * Toda la aritmética se hace en UTC para no depender de la zona horaria del servidor.
 */
export type ISODate = string;

const DAY_MS = 86_400_000;

export function toDate(d: ISODate): Date {
  return new Date(`${d}T00:00:00Z`);
}

export function fromDate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

/** Fecha local de `instant` en la zona horaria `tz`. */
export function localDate(instant: Date, tz: string): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Hora local (0-23) de `instant` en `tz`. */
export function localHour(instant: Date, tz: string): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(instant);
  return Number(h);
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromDate(new Date(toDate(d).getTime() + n * DAY_MS));
}

export function addMonths(d: ISODate, n: number): ISODate {
  const date = toDate(d);
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return fromDate(target);
}

/** 0 = domingo … 6 = sábado */
export function weekday(d: ISODate): number {
  return toDate(d).getUTCDay();
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toDate(a).getTime() - toDate(b).getTime()) / DAY_MS);
}

export function startOfWeek(d: ISODate, weekStartsOn = 1): ISODate {
  const offset = (weekday(d) - weekStartsOn + 7) % 7;
  return addDays(d, -offset);
}

export function startOfMonth(d: ISODate): ISODate {
  return `${d.slice(0, 7)}-01`;
}

export function endOfMonth(d: ISODate): ISODate {
  return addDays(addMonths(startOfMonth(d), 1), -1);
}

export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function isISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && fromDate(toDate(s)) === s;
}
