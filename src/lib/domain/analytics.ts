/**
 * Fase 2 — análisis avanzado. Lógica pura sobre datos reales ya agregados (stats_daily) o
 * sesiones individuales. Nada de aquí inventa datos: si no hay muestra suficiente, devuelve null.
 */
import { addDays, addMonths, diffDays, eachDay, type ISODate, startOfMonth, startOfWeek, zonedParts } from "./dates";
import { compare, type Comparison, type DailyStat, isActiveDay, periodRanges, type Range, totals, type Totals } from "./stats";

// ---------------------------------------------------------------------------
// Métricas por día
// ---------------------------------------------------------------------------

export type DayMetric = "focus" | "tasks" | "habits" | "active";

export const DAY_METRIC_LABEL: Record<DayMetric, string> = {
  focus: "Concentración",
  tasks: "Tareas",
  habits: "Hábitos",
  active: "Actividad",
};

/** Valor de un día para una métrica. Concentración en minutos; "actividad" = nº de señales (0–3). */
export function metricValue(d: DailyStat, m: DayMetric): number {
  if (m === "focus") return Math.floor(d.focus_seconds / 60);
  if (m === "tasks") return d.tasks_completed;
  if (m === "habits") return d.habits_done;
  return (d.focus_seconds >= 60 ? 1 : 0) + (d.tasks_completed > 0 ? 1 : 0) + (d.habits_done > 0 ? 1 : 0);
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Niveles 0–4 relativos a tu propio historial (cuartiles de los días con actividad).
 * Así el mapa de calor compara cada día contigo mismo, no con un estándar arbitrario.
 */
export function levelScale(values: number[], metric: DayMetric): (v: number) => 0 | 1 | 2 | 3 | 4 {
  if (metric === "active") return (v) => (v <= 0 ? 0 : (Math.min(4, v + 1) as 2 | 3 | 4));
  const nz = values.filter((v) => v > 0).sort((a, b) => a - b);
  const t1 = quantile(nz, 0.25);
  const t2 = quantile(nz, 0.5);
  const t3 = quantile(nz, 0.75);
  return (v) => (v <= 0 ? 0 : v <= t1 ? 1 : v <= t2 ? 2 : v <= t3 ? 3 : 4);
}

export type HeatCell = { day: ISODate; value: number; level: 0 | 1 | 2 | 3 | 4; inRange: boolean };

/** Calendario de actividad (columnas = semanas, filas = días de la semana) estilo GitHub. */
export function calendarHeatmap(days: DailyStat[], metric: DayMetric, from: ISODate, to: ISODate, weekStartsOn = 1) {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const values = days.filter((d) => d.day >= from && d.day <= to).map((d) => metricValue(d, metric));
  const level = levelScale(values, metric);
  const weeks: HeatCell[][] = [];
  const months: { week: number; month: string }[] = [];
  let lastMonth = "";
  for (let w = startOfWeek(from, weekStartsOn); w <= to; w = addDays(w, 7)) {
    const col: HeatCell[] = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(w, i);
      const inRange = day >= from && day <= to;
      const d = byDay.get(day);
      const value = inRange && d ? metricValue(d, metric) : 0;
      col.push({ day, value, level: inRange ? level(value) : 0, inRange });
      // Etiqueta de mes en la columna donde empieza (o en la primera columna del rango).
      if (inRange && (day.slice(8) === "01" || weeks.length === 0) && day.slice(0, 7) !== lastMonth) {
        lastMonth = day.slice(0, 7);
        months.push({ week: weeks.length, month: `${lastMonth}-01` });
      }
    }
    weeks.push(col);
  }
  return { weeks, months, total: values.reduce((a, v) => a + v, 0), activeDays: values.filter((v) => v > 0).length };
}

// ---------------------------------------------------------------------------
// Agrupación por semanas / meses y comparativas
// ---------------------------------------------------------------------------

export type Bucket = { key: string; from: ISODate; to: ISODate; totals: Totals };

/** Agrupa días en semanas (según inicio de semana) o meses naturales. Las semanas/meses parciales se marcan por su rango real. */
export function bucketize(days: DailyStat[], unit: "week" | "month", weekStartsOn = 1): Bucket[] {
  const groups = new Map<string, DailyStat[]>();
  for (const d of days) {
    const key = unit === "week" ? startOfWeek(d.day, weekStartsOn) : startOfMonth(d.day);
    const g = groups.get(key);
    if (g) g.push(d);
    else groups.set(key, [d]);
  }
  return [...groups]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, ds]) => ({ key, from: ds[0].day, to: ds[ds.length - 1].day, totals: totals(ds) }));
}

export type PeriodComparison = {
  kind: "week" | "month" | "year";
  current: Range;
  previous: Range;
  focus: Comparison;
  tasks: Comparison;
  habits: Comparison;
  activeDays: Comparison;
  /** El período anterior es anterior (total o parcialmente) a la creación de la cuenta. */
  previousBeforeAccount: boolean;
};

function sumRange(byDay: Map<ISODate, DailyStat>, r: Range): Totals {
  return totals(eachDay(r.from, r.to).map((day) => byDay.get(day) ?? { day, focus_seconds: 0, focus_sessions: 0, interruptions: 0, tasks_completed: 0, habits_done: 0 }));
}

/** Semana, mes y año en curso frente al mismo tramo del período anterior (mismos días transcurridos). */
export function periodComparisons(days: DailyStat[], today: ISODate, weekStartsOn = 1, accountStart?: ISODate): PeriodComparison[] {
  const byDay = new Map(days.map((d) => [d.day, d]));
  return (["week", "month", "year"] as const).map((kind) => {
    const { current, previous } = periodRanges(kind, today, weekStartsOn);
    const c = sumRange(byDay, current);
    const p = sumRange(byDay, previous);
    return {
      kind,
      current,
      previous,
      focus: compare(c.focus_seconds, p.focus_seconds),
      tasks: compare(c.tasks_completed, p.tasks_completed),
      habits: compare(c.habits_done, p.habits_done),
      activeDays: compare(c.active_days, p.active_days),
      previousBeforeAccount: accountStart ? previous.from < accountStart : false,
    };
  });
}

const PERIOD_WORDS = {
  week: { this: "Esta semana", prev: "la semana anterior" },
  month: { this: "Este mes", prev: "el mes anterior" },
  year: { this: "Este año", prev: "el año anterior" },
} as const;

function hoursText(seconds: number): string {
  const h = seconds / 3600;
  if (h < 1) return `${Math.round(seconds / 60)} min`;
  return `${h < 10 ? h.toFixed(1).replace(".", ",").replace(",0", "") : Math.round(h)} h`;
}

/**
 * Frases honestas tipo "Esta semana te concentraste 12 h, un 25 % más que la anterior".
 * Sin datos previos no se da porcentaje; con muy poca base (< 30 min o < 3 tareas) tampoco,
 * porque un "+400 %" sobre casi nada no informa.
 */
export function comparisonSentences(c: PeriodComparison): string[] {
  const w = PERIOD_WORDS[c.kind];
  const out: string[] = [];
  const pctText = (cmp: Comparison, minBase: number) => {
    if (cmp.previous === 0 || cmp.previous < minBase || cmp.pct === null) return null;
    const v = Math.abs(Math.round(cmp.pct * 100));
    if (v === 0) return `lo mismo que ${w.prev}`;
    return `un ${v} % ${cmp.delta > 0 ? "más" : "menos"} que ${w.prev}`;
  };
  if (c.focus.current > 0) {
    const p = pctText(c.focus, 1800);
    out.push(
      `${w.this} te concentraste ${hoursText(c.focus.current)}${
        p ? `, ${p}` : c.focus.previous > 0 ? ` (frente a ${hoursText(c.focus.previous)} en ${w.prev})` : ""
      }.`,
    );
  }
  if (c.tasks.current > 0 || c.tasks.previous > 0) {
    out.push(
      c.tasks.previous > 0
        ? `${w.this} completaste ${c.tasks.current} ${c.tasks.current === 1 ? "tarea" : "tareas"} frente a ${c.tasks.previous} en ${w.prev}.`
        : `${w.this} completaste ${c.tasks.current} ${c.tasks.current === 1 ? "tarea" : "tareas"}.`,
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tendencias
// ---------------------------------------------------------------------------

/** Media móvil de `window` días (los primeros días usan los disponibles). */
export function rollingAverage(values: number[], window = 7): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out.push(sum / Math.min(window, i + 1));
  }
  return out;
}

export type ConsistencyTrend = {
  recentRate: number;
  previousRate: number;
  recentDays: number;
  previousDays: number;
  trend: "up" | "down" | "flat";
  sentence: string;
};

/**
 * Constancia en los últimos `span` días: % de días activos en la mitad reciente frente a la anterior.
 * Los días de descanso y los anteriores a la cuenta no cuentan en el denominador. Null si no hay
 * al menos 14 días comparables en cada mitad.
 */
export function consistencyTrend(days: DailyStat[], today: ISODate, restDays: Iterable<ISODate> = [], accountStart?: ISODate, span = 90): ConsistencyTrend | null {
  const rest = new Set(restDays);
  const half = Math.floor(span / 2);
  const byDay = new Map(days.map((d) => [d.day, d]));
  const rate = (from: ISODate, to: ISODate) => {
    let n = 0;
    let active = 0;
    for (const day of eachDay(from, to)) {
      if (accountStart && day < accountStart) continue;
      if (rest.has(day)) continue;
      n++;
      const d = byDay.get(day);
      if (d && isActiveDay(d)) active++;
    }
    return { n, rate: n ? active / n : 0 };
  };
  const recent = rate(addDays(today, -(half - 1)), today);
  const previous = rate(addDays(today, -(2 * half - 1)), addDays(today, -half));
  if (recent.n < 14 || previous.n < 14) return null;
  const diff = recent.rate - previous.rate;
  const trend = Math.abs(diff) < 0.05 ? "flat" : diff > 0 ? "up" : "down";
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  const weeks = Math.round(half / 7);
  const detail = `activo el ${pct(recent.rate)} de los días en las últimas ${weeks} semanas frente al ${pct(previous.rate)} en las ${weeks} anteriores`;
  const sentence =
    trend === "up"
      ? `Tu constancia mejoró durante los últimos ${span} días: ${detail}.`
      : trend === "down"
        ? `Tu constancia bajó en los últimos ${span} días: ${detail}. Una sesión corta al día basta para recuperarla.`
        : `Tu constancia se mantiene estable en los últimos ${span} días: ${detail}.`;
  return { recentRate: recent.rate, previousRate: previous.rate, recentDays: recent.n, previousDays: previous.n, trend, sentence };
}

// ---------------------------------------------------------------------------
// Récords personales
// ---------------------------------------------------------------------------

export type PersonalRecords = {
  bestFocusDay: { day: ISODate; seconds: number } | null;
  bestTasksDay: { day: ISODate; tasks: number } | null;
  bestWeek: { from: ISODate; seconds: number } | null;
  bestMonth: { month: ISODate; seconds: number } | null;
  longestActiveRun: { from: ISODate; to: ISODate; days: number } | null;
};

export function personalRecords(days: DailyStat[], weekStartsOn = 1, restDays: Iterable<ISODate> = []): PersonalRecords {
  const rest = new Set(restDays);
  let bestFocusDay: PersonalRecords["bestFocusDay"] = null;
  let bestTasksDay: PersonalRecords["bestTasksDay"] = null;
  for (const d of days) {
    if (d.focus_seconds > 0 && (!bestFocusDay || d.focus_seconds > bestFocusDay.seconds)) bestFocusDay = { day: d.day, seconds: d.focus_seconds };
    if (d.tasks_completed > 0 && (!bestTasksDay || d.tasks_completed > bestTasksDay.tasks)) bestTasksDay = { day: d.day, tasks: d.tasks_completed };
  }
  const weeks = bucketize(days, "week", weekStartsOn).filter((b) => b.totals.focus_seconds > 0);
  const bw = weeks.sort((a, b) => b.totals.focus_seconds - a.totals.focus_seconds)[0];
  const months = bucketize(days, "month").filter((b) => b.totals.focus_seconds > 0);
  const bm = months.sort((a, b) => b.totals.focus_seconds - a.totals.focus_seconds)[0];

  // Racha más larga de días activos (los descansos no la rompen ni suman).
  let longestActiveRun: PersonalRecords["longestActiveRun"] = null;
  let runStart: ISODate | null = null;
  let runDays = 0;
  const sorted = [...days].sort((a, b) => (a.day < b.day ? -1 : 1));
  for (const d of sorted) {
    if (isActiveDay(d)) {
      if (!runStart) runStart = d.day;
      runDays++;
      if (!longestActiveRun || runDays > longestActiveRun.days) longestActiveRun = { from: runStart, to: d.day, days: runDays };
    } else if (!rest.has(d.day)) {
      runStart = null;
      runDays = 0;
    }
  }
  return {
    bestFocusDay,
    bestTasksDay,
    bestWeek: bw ? { from: bw.key, seconds: bw.totals.focus_seconds } : null,
    bestMonth: bm ? { month: bm.key, seconds: bm.totals.focus_seconds } : null,
    longestActiveRun: longestActiveRun && longestActiveRun.days >= 2 ? longestActiveRun : null,
  };
}

// ---------------------------------------------------------------------------
// Patrones: día de la semana × hora
// ---------------------------------------------------------------------------

export type SessionPoint = {
  started_at: string;
  focus_seconds: number;
  status: "completed" | "abandoned";
  category_id: string | null;
  project_id: string | null;
};

export type HourMatrix = { seconds: number[][]; sessions: number[][]; total: number };

const emptyMatrix = (): HourMatrix => ({
  seconds: Array.from({ length: 7 }, () => Array<number>(24).fill(0)),
  sessions: Array.from({ length: 7 }, () => Array<number>(24).fill(0)),
  total: 0,
});

/** Minutos de concentración por (día de la semana, hora de inicio) en la zona del usuario. Solo sesiones completadas. */
export function weekdayHourMatrix(sessions: SessionPoint[], tz: string, filter?: (s: SessionPoint) => boolean): HourMatrix {
  const m = emptyMatrix();
  for (const s of sessions) {
    if (s.status !== "completed" || (filter && !filter(s))) continue;
    const z = zonedParts(new Date(s.started_at), tz);
    m.seconds[z.weekday][z.hour] += s.focus_seconds;
    m.sessions[z.weekday][z.hour] += 1;
    m.total += 1;
  }
  return m;
}

/** Media diaria por día de la semana. Solo cuenta los días transcurridos del rango (y posteriores a la cuenta). */
export function weekdayAverages(days: DailyStat[]) {
  const acc = Array.from({ length: 7 }, (_, weekday) => ({ weekday, days: 0, focus_seconds: 0, tasks: 0, active: 0 }));
  for (const d of days) {
    const w = new Date(`${d.day}T00:00:00Z`).getUTCDay();
    acc[w].days++;
    acc[w].focus_seconds += d.focus_seconds;
    acc[w].tasks += d.tasks_completed;
    acc[w].active += isActiveDay(d) ? 1 : 0;
  }
  return acc.map((a) => ({
    weekday: a.weekday,
    days: a.days,
    avgFocusSeconds: a.days ? a.focus_seconds / a.days : 0,
    avgTasks: a.days ? a.tasks / a.days : 0,
    activeRate: a.days ? a.active / a.days : 0,
  }));
}

/** Día de la semana claramente mejor que la media (≥ 1,4×) con al menos 4 semanas de datos. */
export function bestWeekday(days: DailyStat[]): { weekday: number; avgFocusSeconds: number; overallAvg: number; weeks: number } | null {
  const avgs = weekdayAverages(days);
  const weeks = Math.min(...avgs.map((a) => a.days));
  if (weeks < 4) return null;
  const overall = days.reduce((a, d) => a + d.focus_seconds, 0) / days.length;
  if (overall < 300) return null;
  const best = [...avgs].sort((a, b) => b.avgFocusSeconds - a.avgFocusSeconds)[0];
  if (best.avgFocusSeconds < overall * 1.4) return null;
  return { weekday: best.weekday, avgFocusSeconds: best.avgFocusSeconds, overallAvg: overall, weeks };
}

/** Mejor franja de 3 horas (por tiempo total) con al menos `minSessions` sesiones completadas. */
export function bestBlock(sessions: SessionPoint[], tz: string, minSessions = 3): { start: number; seconds: number; sessions: number } | null {
  const blocks = Array.from({ length: 8 }, (_, b) => ({ start: b * 3, seconds: 0, sessions: 0 }));
  for (const s of sessions) {
    if (s.status !== "completed") continue;
    const b = blocks[Math.floor(zonedParts(new Date(s.started_at), tz).hour / 3)];
    b.seconds += s.focus_seconds;
    b.sessions++;
  }
  return blocks.filter((b) => b.sessions >= minSessions).sort((a, b) => b.seconds - a.seconds)[0] ?? null;
}

/** % de sesiones terminadas (no abandonadas) por franja de 3 h. Útil para ver cuándo cuesta más mantener el foco. */
export function completionByBlock(sessions: SessionPoint[], tz: string) {
  const blocks = Array.from({ length: 8 }, (_, b) => ({ start: b * 3, completed: 0, abandoned: 0 }));
  for (const s of sessions) {
    const b = blocks[Math.floor(zonedParts(new Date(s.started_at), tz).hour / 3)];
    if (s.status === "completed") b.completed++;
    else b.abandoned++;
  }
  return blocks.map((b) => ({ ...b, rate: b.completed + b.abandoned ? b.completed / (b.completed + b.abandoned) : null }));
}

// ---------------------------------------------------------------------------
// Proyectos
// ---------------------------------------------------------------------------

export type ProjectTaskRow = { project_id: string | null; parent_id: string | null; status: string; completed_at: string | null; actual_seconds: number };
export type ProjectRow = { id: string; name: string; status: string; target_date: string | null; category_id: string | null; created_at?: string };

export type ProjectStat = {
  id: string;
  created_at?: string;
  name: string;
  status: string;
  target_date: string | null;
  category_id: string | null;
  tasksTotal: number;
  tasksDone: number;
  progress: number | null;
  focusInRange: number;
  focusAllTime: number;
  lastActivity: string | null;
  /** Tareas cerradas por semana en las últimas 4 semanas. */
  weeklyPace: number;
  /** Fecha estimada de fin al ritmo actual; null si no hay ritmo medible o nada pendiente. */
  projectedFinish: ISODate | null;
  onTrack: boolean | null;
  weekly: number[];
};

/**
 * Métricas por proyecto a partir de tareas (solo de primer nivel para el progreso) y sesiones.
 * La proyección solo se calcula con ≥ 2 tareas cerradas en las últimas 4 semanas.
 */
export function projectStats(
  projects: ProjectRow[],
  tasks: ProjectTaskRow[],
  sessions: SessionPoint[],
  today: ISODate,
  tz: string,
  weekStartsOn = 1,
  weeksBack = 12,
): ProjectStat[] {
  const since28 = addDays(today, -27);
  const firstWeek = addDays(startOfWeek(today, weekStartsOn), -7 * (weeksBack - 1));
  return projects.map((p) => {
    const own = tasks.filter((t) => t.project_id === p.id);
    const top = own.filter((t) => !t.parent_id && t.status !== "archived");
    const done = top.filter((t) => t.status === "done");
    const recentDone = done.filter((t) => t.completed_at && zonedParts(new Date(t.completed_at), tz).date >= since28).length;
    const ps = sessions.filter((s) => s.project_id === p.id && s.status === "completed");
    const weekly = Array<number>(weeksBack).fill(0);
    let focusInRange = 0;
    let lastActivity: string | null = null;
    for (const s of ps) {
      focusInRange += s.focus_seconds;
      if (!lastActivity || s.started_at > lastActivity) lastActivity = s.started_at;
      const day = zonedParts(new Date(s.started_at), tz).date;
      const idx = Math.floor(diffDays(day, firstWeek) / 7);
      if (idx >= 0 && idx < weeksBack) weekly[idx] += s.focus_seconds;
    }
    for (const t of done) if (t.completed_at && (!lastActivity || t.completed_at > lastActivity)) lastActivity = t.completed_at;
    const remaining = top.length - done.length;
    const weeklyPace = recentDone / 4;
    let projectedFinish: ISODate | null = null;
    if (remaining > 0 && recentDone >= 2) projectedFinish = addDays(today, Math.ceil((remaining / weeklyPace) * 7));
    const onTrack = projectedFinish && p.target_date ? projectedFinish <= p.target_date : remaining === 0 && top.length > 0 ? true : null;
    return {
      id: p.id,
      created_at: p.created_at,
      name: p.name,
      status: p.status,
      target_date: p.target_date,
      category_id: p.category_id,
      tasksTotal: top.length,
      tasksDone: done.length,
      progress: top.length ? done.length / top.length : null,
      focusInRange,
      focusAllTime: own.reduce((a, t) => a + t.actual_seconds, 0),
      lastActivity,
      weeklyPace,
      projectedFinish,
      onTrack,
      weekly,
    };
  });
}

/** Proyectos activos sin actividad en `days` días que aún tienen tareas pendientes. */
export function stalledProjects(stats: ProjectStat[], today: ISODate, tz: string, days = 14) {
  return stats.filter((p) => {
    if (p.status !== "active" || p.tasksTotal === p.tasksDone) return false;
    // Un proyecto recién creado no está "parado".
    if (p.created_at && diffDays(today, zonedParts(new Date(p.created_at), tz).date) < days) return false;
    if (!p.lastActivity) return p.tasksTotal > 0;
    return diffDays(today, zonedParts(new Date(p.lastActivity), tz).date) >= days;
  });
}

/** Precisión de estimaciones por categoría (real / estimado) con al menos 3 tareas. */
export function estimateAccuracyByCategory(rows: { category_id: string | null; estimated_minutes: number | null; actual_seconds: number }[]) {
  const groups = new Map<string | null, { est: number; act: number; n: number }>();
  for (const r of rows) {
    if (!r.estimated_minutes || r.actual_seconds < 60) continue;
    const g = groups.get(r.category_id) ?? { est: 0, act: 0, n: 0 };
    g.est += r.estimated_minutes * 60;
    g.act += r.actual_seconds;
    g.n++;
    groups.set(r.category_id, g);
  }
  return [...groups]
    .filter(([, g]) => g.n >= 3)
    .map(([category_id, g]) => ({ category_id, ratio: g.act / g.est, sample: g.n }))
    .sort((a, b) => Math.abs(Math.log(b.ratio)) - Math.abs(Math.log(a.ratio)));
}

/** Rango [hoy - n + 1, hoy] recortado al inicio de la cuenta. */
export function lastDays(today: ISODate, n: number, accountStart?: ISODate): Range {
  const from = addDays(today, -(n - 1));
  return { from: accountStart && accountStart > from ? accountStart : from, to: today };
}

/** Últimos `n` meses naturales completos + el actual, como claves YYYY-MM-01. */
export function lastMonths(today: ISODate, n: number): ISODate[] {
  const start = startOfMonth(today);
  return Array.from({ length: n }, (_, i) => addMonths(start, i - (n - 1)));
}
