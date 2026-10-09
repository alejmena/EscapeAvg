import { addDays, addMonths, diffDays, type ISODate, startOfMonth, startOfWeek, startOfYear } from "./dates";
import { type CategoryInfo, type DayTotals, hoursText, rankFor, RANKS, type RankId } from "./discipline";

/**
 * Desarrollo acumulado: cuánto has invertido en ti, por categoría y en el tiempo.
 * Solo usa horas productivas (sin solapes, sin descansos, sin "solo ocupado").
 */

export type CategoryHours = { id: string | null; name: string; color: string; seconds: number; activeDays: number };

export type DevelopmentReport = {
  window: number;
  current: CategoryHours[];
  totalSeconds: number;
  previousSeconds: number;
  avgDaily: number;
  prevAvgDaily: number;
  insights: string[];
  strongest: CategoryHours | null;
  weakest: CategoryHours | null;
};

const NO_CATEGORY = { name: "Sin categoría", color: "#94a3b8" };
const fmtH = (s: number) => (s / 3600).toLocaleString("es", { maximumFractionDigits: 1, minimumFractionDigits: s % 3600 ? 1 : 0 });

function byCategory(days: Map<ISODate, DayTotals>, from: ISODate, to: ISODate, cats: CategoryInfo[]): CategoryHours[] {
  const info = new Map(cats.map((c) => [c.id, c]));
  const acc = new Map<string | null, CategoryHours>();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const t = days.get(d);
    if (!t) continue;
    for (const [id, secs] of t.byCategory) {
      if (secs <= 0) continue;
      const c = id ? info.get(id) : undefined;
      let row = acc.get(id);
      if (!row) acc.set(id, (row = { id, name: c?.name ?? NO_CATEGORY.name, color: c?.color ?? NO_CATEGORY.color, seconds: 0, activeDays: 0 }));
      row.seconds += secs;
      if (secs >= 15 * 60) row.activeDays++;
    }
  }
  return [...acc.values()].sort((a, b) => b.seconds - a.seconds);
}

function sumRange(days: Map<ISODate, DayTotals>, from: ISODate, to: ISODate): number {
  let s = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) s += days.get(d)?.productive ?? 0;
  return s;
}

/** Informe de los últimos `window` días (incluido hoy) frente a los `window` anteriores. */
export function developmentReport(days: Map<ISODate, DayTotals>, today: ISODate, cats: CategoryInfo[], window = 30): DevelopmentReport {
  const from = addDays(today, -(window - 1));
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(window - 1));
  const current = byCategory(days, from, today, cats);
  const totalSeconds = current.reduce((a, c) => a + c.seconds, 0);
  const previousSeconds = sumRange(days, prevFrom, prevTo);
  const avgDaily = totalSeconds / window;
  const prevAvgDaily = previousSeconds / window;

  const insights: string[] = [];
  const delta = totalSeconds - previousSeconds;
  if (previousSeconds > 0 && Math.abs(delta) >= 3600) {
    insights.push(
      delta > 0
        ? `Has dedicado ${hoursText(delta)} más a tu desarrollo que en los ${window} días anteriores.`
        : `Has dedicado ${hoursText(-delta)} menos a tu desarrollo que en los ${window} días anteriores.`,
    );
  } else if (previousSeconds === 0 && totalSeconds > 0) {
    insights.push(`Es tu primer período completo: ${fmtH(totalSeconds)} horas invertidas en ti.`);
  }
  if (previousSeconds > 0 && totalSeconds > 0) {
    const a = fmtH(prevAvgDaily);
    const b = fmtH(avgDaily);
    if (a !== b) insights.push(`Tu promedio diario ${avgDaily > prevAvgDaily ? "aumentó" : "bajó"} de ${a} a ${b} horas.`);
  }

  // Constancia = días con al menos 15 min en la categoría. Solo se compara si hay 2+ categorías con práctica real.
  const ranked = current.filter((c) => c.id !== null && c.seconds >= 3600);
  let strongest: CategoryHours | null = null;
  let weakest: CategoryHours | null = null;
  if (ranked.length >= 2) {
    const byConsistency = [...ranked].sort((a, b) => b.activeDays - a.activeDays || b.seconds - a.seconds);
    strongest = byConsistency[0];
    weakest = byConsistency[byConsistency.length - 1];
    if (strongest.activeDays > weakest.activeDays) {
      insights.push(`Tu mayor fortaleza es la constancia en ${strongest.name.toLowerCase()} (${strongest.activeDays} días de ${window}).`);
      insights.push(`Tu actividad menos constante es ${weakest.name.toLowerCase()} (${weakest.activeDays} días de ${window}).`);
    } else {
      strongest = weakest = null;
    }
  }

  return { window, current, totalSeconds, previousSeconds, avgDaily, prevAvgDaily, insights, strongest, weakest };
}

// ---------------------------------------------------------------------------
// Series para gráficas
// ---------------------------------------------------------------------------

export type SeriesPoint = { key: string; from: ISODate; to: ISODate; seconds: number };
export type Granularity = "day" | "week" | "month" | "year";

export function series(days: Map<ISODate, DayTotals>, today: ISODate, g: Granularity, weekStartsOn = 1, firstDay?: ISODate): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  if (g === "day") {
    for (let i = 29; i >= 0; i--) {
      const d = addDays(today, -i);
      out.push({ key: d, from: d, to: d, seconds: days.get(d)?.productive ?? 0 });
    }
  } else if (g === "week") {
    const cur = startOfWeek(today, weekStartsOn);
    for (let i = 11; i >= 0; i--) {
      const from = addDays(cur, -7 * i);
      const to = addDays(from, 6) > today ? today : addDays(from, 6);
      out.push({ key: from, from, to, seconds: sumRange(days, from, to) });
    }
  } else if (g === "month") {
    const cur = startOfMonth(today);
    for (let i = 11; i >= 0; i--) {
      const from = addMonths(cur, -i);
      const end = addDays(addMonths(from, 1), -1);
      const to = end > today ? today : end;
      out.push({ key: from, from, to, seconds: sumRange(days, from, to) });
    }
  } else {
    const first = firstDay ?? today;
    for (let y = Number(first.slice(0, 4)); y <= Number(today.slice(0, 4)); y++) {
      const from = startOfYear(`${y}-01-01`);
      const to = `${y}-12-31` > today ? today : `${y}-12-31`;
      out.push({ key: from, from, to, seconds: sumRange(days, from, to) });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Récords
// ---------------------------------------------------------------------------

export type Records = {
  bestDay: { day: ISODate; seconds: number } | null;
  bestWeek: { from: ISODate; seconds: number } | null;
  bestMonth: { from: ISODate; seconds: number } | null;
  totalSeconds: number;
  goalDays: number;
  longestGoalStreak: number;
  /** Cuántos días alcanzaste cada rango (como máximo del día). */
  rankDays: { id: RankId; days: number }[];
};

export function records(days: Map<ISODate, DayTotals>, goalMinutes: number, weekStartsOn = 1, restDays: Set<ISODate> = new Set()): Records {
  const goal = goalMinutes * 60;
  let bestDay: Records["bestDay"] = null;
  const weeks = new Map<ISODate, number>();
  const months = new Map<ISODate, number>();
  let totalSeconds = 0;
  let goalDays = 0;
  const rankCount = new Map<RankId, number>();
  const sorted = [...days.keys()].sort();
  for (const d of sorted) {
    const s = days.get(d)!.productive;
    if (s <= 0) continue;
    totalSeconds += s;
    if (!bestDay || s > bestDay.seconds) bestDay = { day: d, seconds: s };
    const w = startOfWeek(d, weekStartsOn);
    weeks.set(w, (weeks.get(w) ?? 0) + s);
    const m = startOfMonth(d);
    months.set(m, (months.get(m) ?? 0) + s);
    if (s >= goal) goalDays++;
    const r = rankFor(s).id;
    if (r !== "inicio") rankCount.set(r, (rankCount.get(r) ?? 0) + 1);
  }
  const best = (m: Map<ISODate, number>) => {
    let b: { from: ISODate; seconds: number } | null = null;
    for (const [from, seconds] of m) if (!b || seconds > b.seconds) b = { from, seconds };
    return b;
  };

  // Racha más larga de días que cumplen el objetivo; los días de descanso no la rompen.
  let longest = 0;
  let run = 0;
  if (sorted.length) {
    for (let d = sorted[0]; d <= sorted[sorted.length - 1]; d = addDays(d, 1)) {
      if ((days.get(d)?.productive ?? 0) >= goal) longest = Math.max(longest, ++run);
      else if (!restDays.has(d)) run = 0;
    }
  }

  return {
    bestDay,
    bestWeek: best(weeks),
    bestMonth: best(months),
    totalSeconds,
    goalDays,
    longestGoalStreak: longest,
    rankDays: RANKS.filter((r) => r.id !== "inicio").map((r) => ({ id: r.id, days: rankCount.get(r.id) ?? 0 })),
  };
}

export function spanDays(from: ISODate, to: ISODate): number {
  return diffDays(to, from) + 1;
}

// ---------------------------------------------------------------------------
// Maestría por habilidad: horas acumuladas en cada categoría hacia una meta de experto.
// ---------------------------------------------------------------------------

/** Meta de maestría por habilidad (horas). Configurable aquí. */
export const MASTERY_HOURS = 3000;

export type MasteryLevel = { minHours: number; name: string };

export const MASTERY_LEVELS: readonly MasteryLevel[] = [
  { minHours: 0, name: "Curiosidad" },
  { minHours: 20, name: "Aprendiz" },
  { minHours: 100, name: "Practicante" },
  { minHours: 300, name: "Competente" },
  { minHours: 1000, name: "Avanzado" },
  { minHours: 2000, name: "Experto" },
  { minHours: 3000, name: "Maestría" },
];

/**
 * Posición SIMBÓLICA frente a la gente según horas de práctica. No es una estadística real:
 * es una curva interna para dar forma al progreso (las primeras horas mueven mucho, luego cada vez menos).
 */
const CURVE: [number, number][] = [
  [0, 0],
  [20, 40],
  [100, 55],
  [300, 65],
  [500, 70],
  [1000, 80],
  [2000, 90],
  [3000, 95],
  [5000, 98],
  [10000, 99.9],
];

export function symbolicPercentile(hours: number): number {
  const h = Math.max(0, hours);
  for (let i = 1; i < CURVE.length; i++) {
    const [h0, p0] = CURVE[i - 1];
    const [h1, p1] = CURVE[i];
    if (h <= h1) return Math.round(p0 + ((h - h0) / (h1 - h0)) * (p1 - p0));
  }
  return 99.9;
}

export type Mastery = {
  id: string | null;
  name: string;
  color: string;
  seconds: number;
  level: MasteryLevel;
  next: MasteryLevel | null;
  /** 0–1 hacia la meta de maestría. */
  progress: number;
  percentile: number;
  /** Horas al día en los últimos 30 días. */
  recentDaily: number;
  /** Días estimados hasta la maestría a ese ritmo (null si no hay ritmo). */
  etaDays: number | null;
};

export function mastery(days: Map<ISODate, DayTotals>, today: ISODate, cats: CategoryInfo[]): Mastery[] {
  const info = new Map(cats.map((c) => [c.id, c]));
  const total = new Map<string | null, number>();
  const recent = new Map<string | null, number>();
  const from30 = addDays(today, -29);
  for (const [day, t] of days) {
    for (const [id, secs] of t.byCategory) {
      total.set(id, (total.get(id) ?? 0) + secs);
      if (day >= from30 && day <= today) recent.set(id, (recent.get(id) ?? 0) + secs);
    }
  }
  const out: Mastery[] = [];
  for (const [id, seconds] of total) {
    if (id === null || seconds < 60) continue;
    const c = info.get(id);
    if (!c) continue;
    const hours = seconds / 3600;
    let li = 0;
    for (let i = 0; i < MASTERY_LEVELS.length; i++) if (hours >= MASTERY_LEVELS[i].minHours) li = i;
    const recentDaily = (recent.get(id) ?? 0) / 3600 / 30;
    const left = MASTERY_HOURS - hours;
    out.push({
      id,
      name: c.name,
      color: c.color,
      seconds,
      level: MASTERY_LEVELS[li],
      next: MASTERY_LEVELS[li + 1] ?? null,
      progress: Math.min(1, hours / MASTERY_HOURS),
      percentile: symbolicPercentile(hours),
      recentDaily,
      etaDays: left > 0 && recentDaily > 0 ? Math.ceil(left / recentDaily) : null,
    });
  }
  return out.sort((a, b) => b.seconds - a.seconds);
}

/** "3 años y 2 meses", "8 meses", "25 días". */
export function etaText(days: number): string {
  if (days < 60) return `${days} días`;
  const months = Math.round(days / 30.4);
  if (months < 24) return `${months} meses`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} años y ${m} ${m === 1 ? "mes" : "meses"}` : `${y} años`;
}
