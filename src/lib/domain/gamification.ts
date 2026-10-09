/**
 * Fase 3 — gamificación. Todo el XP se DERIVA de datos verificables (sesiones con tiempo real medido,
 * tareas, hábitos y objetivos), con reglas públicas y topes diarios. No hay un "saldo" editable:
 * recalcular siempre da el mismo resultado, así que no se puede inflar creando tareas vacías.
 */
import { addDays, diffDays, type ISODate, startOfMonth, startOfWeek, endOfMonth, zonedParts } from "./dates";
import type { GoalMetric, GoalPeriod } from "./goals";

// ---------------------------------------------------------------------------
// Entradas
// ---------------------------------------------------------------------------

/** Sesión completada (sin descansos). */
export type XpSession = { started_at: string; focus_seconds: number; kind: string; category_id: string | null };
export type XpTask = {
  created_at: string;
  completed_at: string;
  actual_seconds: number;
  parent_id: string | null;
  category_id: string | null;
  estimated_minutes: number | null;
};
export type XpHabitLog = { log_date: ISODate; habit_id: string };
export type XpGoal = {
  id: string;
  title: string;
  metric: GoalMetric;
  period: GoalPeriod;
  start_date: ISODate | null;
  end_date: ISODate | null;
  target_value: number;
  category_id: string | null;
  created_at: string;
};
export type XpSources = {
  sessions: XpSession[];
  tasks: XpTask[];
  habitLogs: XpHabitLog[];
  habitCategory: Record<string, string | null>;
  goals: XpGoal[];
  restDays: ISODate[];
};

// ---------------------------------------------------------------------------
// Reglas (públicas en la página de Progreso)
// ---------------------------------------------------------------------------

export const XP_RULES = {
  focusPerMinute: 1,
  focusSessionCapMinutes: 120,
  manualFactor: 0.5,
  focusDailyCap: 480,
  justStartBonus: 10,
  justStartMinSeconds: 90,
  justStartDailyMax: 3,
  task: 10,
  subtask: 3,
  taskMinAgeMinutes: 10,
  taskMinFocusSeconds: 300,
  tasksDailyMax: 15,
  subtasksDailyMax: 20,
  habit: 15,
  activeDay: 20,
  consistentWeek: 50,
  consistentWeekDays: 4,
  goalWeekly: 50,
  goalMonthly: 150,
  goalCustomPerDay: 10,
  goalCustomMax: 150,
  goalsPerWeekMax: 3,
  goalMin: { focus_minutes: 30, tasks_completed: 3, habit_completions: 3 } as Record<string, number>,
} as const;

export type XpSource = "focus" | "just_start" | "tasks" | "habits" | "active_day" | "consistency" | "goals";

export const XP_SOURCE_LABEL: Record<XpSource, string> = {
  focus: "Concentración",
  just_start: "Just Start",
  tasks: "Tareas",
  habits: "Hábitos",
  active_day: "Días activos",
  consistency: "Semanas constantes",
  goals: "Objetivos y desafíos",
};

export type LedgerEntry = { day: ISODate; source: XpSource; xp: number };

// ---------------------------------------------------------------------------
// Hechos diarios derivados (compartidos por XP y logros)
// ---------------------------------------------------------------------------

export type DayFacts = {
  focusSeconds: number;
  focusByCat: Map<string | null, number>;
  tasks: number;
  tasksByCat: Map<string | null, number>;
  habits: number;
  habitsByCat: Map<string | null, number>;
};

const inc = <K>(m: Map<K, number>, k: K, v: number) => m.set(k, (m.get(k) ?? 0) + v);

/** Una tarea cuenta para XP si no se creó y cerró en el mismo instante: antigüedad mínima o tiempo real dedicado. */
export function taskEligible(t: XpTask): boolean {
  const ageMin = (Date.parse(t.completed_at) - Date.parse(t.created_at)) / 60_000;
  return ageMin >= XP_RULES.taskMinAgeMinutes || t.actual_seconds >= XP_RULES.taskMinFocusSeconds;
}

export function dayFacts(src: XpSources, tz: string, today: ISODate): Map<ISODate, DayFacts> {
  const days = new Map<ISODate, DayFacts>();
  const get = (d: ISODate) => {
    let f = days.get(d);
    if (!f) {
      f = { focusSeconds: 0, focusByCat: new Map(), tasks: 0, tasksByCat: new Map(), habits: 0, habitsByCat: new Map() };
      days.set(d, f);
    }
    return f;
  };
  for (const s of src.sessions) {
    const d = zonedParts(new Date(s.started_at), tz).date;
    if (d > today) continue;
    const f = get(d);
    f.focusSeconds += s.focus_seconds;
    inc(f.focusByCat, s.category_id, s.focus_seconds);
  }
  for (const t of src.tasks) {
    const d = zonedParts(new Date(t.completed_at), tz).date;
    if (d > today) continue;
    const f = get(d);
    f.tasks++;
    inc(f.tasksByCat, t.category_id, 1);
  }
  for (const l of src.habitLogs) {
    if (l.log_date > today) continue;
    const f = get(l.log_date);
    f.habits++;
    inc(f.habitsByCat, src.habitCategory[l.habit_id] ?? null, 1);
  }
  return days;
}

export const isActive = (f: DayFacts | undefined) => !!f && (f.focusSeconds >= 60 || f.tasks > 0 || f.habits > 0);

// ---------------------------------------------------------------------------
// Objetivos alcanzados (por período)
// ---------------------------------------------------------------------------

export type GoalAchievement = { goalId: string; title: string; from: ISODate; to: ISODate; day: ISODate; xp: number };

function goalPeriods(g: XpGoal, createdDay: ISODate, today: ISODate, weekStartsOn: number): { from: ISODate; to: ISODate }[] {
  if (g.period === "custom") return g.start_date && g.end_date ? [{ from: g.start_date, to: g.end_date }] : [];
  const out: { from: ISODate; to: ISODate }[] = [];
  let from = g.period === "weekly" ? startOfWeek(createdDay, weekStartsOn) : startOfMonth(createdDay);
  while (from <= today && out.length < 600) {
    const to = g.period === "weekly" ? addDays(from, 6) : endOfMonth(from);
    out.push({ from, to });
    from = addDays(to, 1);
  }
  return out;
}

/**
 * Períodos en que se cumplió cada objetivo medible (no los manuales: no son verificables).
 * Solo cuentan metas con un mínimo razonable (p. ej. ≥ 30 min o ≥ 3 tareas) y desde la semana/mes en que se creó.
 */
export function goalAchievements(src: XpSources, facts: Map<ISODate, DayFacts>, tz: string, today: ISODate, weekStartsOn = 1): GoalAchievement[] {
  const out: GoalAchievement[] = [];
  for (const g of src.goals) {
    if (g.metric === "manual") continue;
    const target = Number(g.target_value);
    if (target < (XP_RULES.goalMin[g.metric] ?? 1)) continue;
    const createdDay = zonedParts(new Date(g.created_at), tz).date;
    for (const p of goalPeriods(g, createdDay, today, weekStartsOn)) {
      let acc = 0;
      const end = p.to < today ? p.to : today;
      for (let d = p.from; d <= end; d = addDays(d, 1)) {
        const f = facts.get(d);
        if (f) {
          const cat = g.category_id;
          if (g.metric === "focus_minutes") acc += (cat ? (f.focusByCat.get(cat) ?? 0) : f.focusSeconds) / 60;
          else if (g.metric === "tasks_completed") acc += cat ? (f.tasksByCat.get(cat) ?? 0) : f.tasks;
          else acc += cat ? (f.habitsByCat.get(cat) ?? 0) : f.habits;
        }
        if (acc >= target) {
          const xp =
            g.period === "weekly"
              ? XP_RULES.goalWeekly
              : g.period === "monthly"
                ? XP_RULES.goalMonthly
                : Math.min(XP_RULES.goalCustomMax, XP_RULES.goalCustomPerDay * (diffDays(p.to, p.from) + 1));
          out.push({ goalId: g.id, title: g.title, from: p.from, to: p.to, day: d, xp });
          break;
        }
      }
    }
  }
  return out.sort((a, b) => (a.day < b.day ? -1 : 1));
}

// ---------------------------------------------------------------------------
// Libro de XP
// ---------------------------------------------------------------------------

export type XpResult = {
  entries: LedgerEntry[];
  total: number;
  byDay: Map<ISODate, number>;
  goals: GoalAchievement[];
  facts: Map<ISODate, DayFacts>;
};

export function computeXp(src: XpSources, tz: string, today: ISODate, weekStartsOn = 1): XpResult {
  const R = XP_RULES;
  const entries: LedgerEntry[] = [];
  const add = (day: ISODate, source: XpSource, xp: number) => {
    if (xp > 0) entries.push({ day, source, xp: Math.round(xp) });
  };

  // Concentración y Just Start, con topes por sesión y por día.
  const focusDay = new Map<ISODate, number>();
  const justDay = new Map<ISODate, number>();
  for (const s of [...src.sessions].sort((a, b) => (a.started_at < b.started_at ? -1 : 1))) {
    const day = zonedParts(new Date(s.started_at), tz).date;
    if (day > today) continue;
    const minutes = Math.floor(Math.min(s.focus_seconds, R.focusSessionCapMinutes * 60) / 60);
    const raw = minutes * R.focusPerMinute * (s.kind === "manual" ? R.manualFactor : 1);
    const used = focusDay.get(day) ?? 0;
    const xp = Math.max(0, Math.min(raw, R.focusDailyCap - used));
    focusDay.set(day, used + xp);
    add(day, "focus", xp);
    if (s.kind === "just_start" && s.focus_seconds >= R.justStartMinSeconds) {
      const n = justDay.get(day) ?? 0;
      if (n < R.justStartDailyMax) {
        justDay.set(day, n + 1);
        add(day, "just_start", R.justStartBonus);
      }
    }
  }

  // Tareas: solo las que pasan el filtro anti‑abuso, con máximo diario.
  const taskDay = new Map<ISODate, { top: number; sub: number }>();
  for (const t of src.tasks) {
    if (!taskEligible(t)) continue;
    const day = zonedParts(new Date(t.completed_at), tz).date;
    if (day > today) continue;
    const c = taskDay.get(day) ?? { top: 0, sub: 0 };
    if (t.parent_id) {
      if (c.sub < R.subtasksDailyMax) {
        c.sub++;
        add(day, "tasks", R.subtask);
      }
    } else if (c.top < R.tasksDailyMax) {
      c.top++;
      add(day, "tasks", R.task);
    }
    taskDay.set(day, c);
  }

  for (const l of src.habitLogs) if (l.log_date <= today) add(l.log_date, "habits", R.habit);

  // Días activos y semanas constantes (los descansos reducen lo exigido, no penalizan).
  const facts = dayFacts(src, tz, today);
  const rest = new Set(src.restDays);
  const weeks = new Map<ISODate, { active: number; rest: number }>();
  for (const [day, f] of facts) {
    if (!isActive(f)) continue;
    add(day, "active_day", R.activeDay);
    const w = startOfWeek(day, weekStartsOn);
    const c = weeks.get(w) ?? { active: 0, rest: 0 };
    c.active++;
    weeks.set(w, c);
  }
  for (const d of rest) {
    const w = startOfWeek(d, weekStartsOn);
    const c = weeks.get(w);
    if (c) c.rest++;
  }
  const currentWeek = startOfWeek(today, weekStartsOn);
  for (const [w, c] of weeks) {
    const needed = Math.max(1, R.consistentWeekDays - c.rest);
    // La semana en curso cuenta en cuanto se alcanza; las pasadas, al cerrarse.
    if (c.active >= needed) add(w < currentWeek ? addDays(w, 6) : today, "consistency", R.consistentWeek);
  }

  // Objetivos y desafíos alcanzados, como máximo 3 por semana.
  const goals = goalAchievements(src, facts, tz, today, weekStartsOn);
  const goalsPerWeek = new Map<ISODate, number>();
  const rewarded: GoalAchievement[] = [];
  for (const g of goals) {
    const w = startOfWeek(g.day, weekStartsOn);
    const n = goalsPerWeek.get(w) ?? 0;
    if (n >= R.goalsPerWeekMax) continue;
    goalsPerWeek.set(w, n + 1);
    rewarded.push(g);
    add(g.day, "goals", g.xp);
  }

  const byDay = new Map<ISODate, number>();
  let total = 0;
  for (const e of entries) {
    byDay.set(e.day, (byDay.get(e.day) ?? 0) + e.xp);
    total += e.xp;
  }
  return { entries, total, byDay, goals: rewarded, facts };
}

export function xpBySource(entries: LedgerEntry[], from?: ISODate, to?: ISODate): Record<XpSource, number> {
  const out = { focus: 0, just_start: 0, tasks: 0, habits: 0, active_day: 0, consistency: 0, goals: 0 } as Record<XpSource, number>;
  for (const e of entries) if ((!from || e.day >= from) && (!to || e.day <= to)) out[e.source] += e.xp;
  return out;
}

export function sumXp(byDay: Map<ISODate, number>, from: ISODate, to: ISODate): number {
  let s = 0;
  for (const [d, v] of byDay) if (d >= from && d <= to) s += v;
  return s;
}

// ---------------------------------------------------------------------------
// Niveles
// ---------------------------------------------------------------------------

/** XP necesario para pasar del nivel L al L+1: crece de forma lineal (150, 225, 300…). */
export function xpForNextLevel(level: number): number {
  return 150 + 75 * (level - 1);
}

/** XP acumulado necesario para alcanzar el nivel L (nivel 1 = 0 XP). */
export function xpToReach(level: number): number {
  const n = level - 1;
  return 150 * n + (75 * n * (n - 1)) / 2;
}

const TITLES: [number, string][] = [
  [1, "Primer paso"],
  [3, "En marcha"],
  [5, "Constante"],
  [8, "Enfocado"],
  [12, "Disciplinado"],
  [16, "Imparable"],
  [20, "Fuera de la media"],
  [30, "Élite personal"],
  [40, "Leyenda"],
];

export function levelTitle(level: number): string {
  let t = TITLES[0][1];
  for (const [l, name] of TITLES) if (level >= l) t = name;
  return t;
}

export type LevelInfo = { level: number; title: string; total: number; into: number; needed: number; ratio: number; nextTitle: { level: number; title: string } | null };

export function levelInfo(total: number): LevelInfo {
  let level = 1;
  while (xpToReach(level + 1) <= total) level++;
  const into = total - xpToReach(level);
  const needed = xpForNextLevel(level);
  const next = TITLES.find(([l]) => l > level);
  return { level, title: levelTitle(level), total, into, needed, ratio: into / needed, nextTitle: next ? { level: next[0], title: next[1] } : null };
}

// ---------------------------------------------------------------------------
// Logros
// ---------------------------------------------------------------------------

export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: "play" | "zap" | "brain" | "clock" | "check" | "flame" | "sunrise" | "moon" | "undo" | "target" | "gauge" | "calendar" | "star";
  tier: 1 | 2 | 3 | 4;
  current: number;
  target: number;
  unlockedAt: ISODate | null;
};

type Def = Omit<Achievement, "current" | "unlockedAt"> & { series: string };

const DEFS: Def[] = [
  { id: "first-session", series: "sessions", title: "Primer paso", description: "Completa tu primera sesión de concentración.", icon: "play", tier: 1, target: 1 },
  { id: "just-start-1", series: "just", title: "Solo empieza", description: "Completa una sesión Just Start.", icon: "zap", tier: 1, target: 1 },
  { id: "just-start-10", series: "just", title: "Vencer la inercia", description: "Completa 10 sesiones Just Start.", icon: "zap", tier: 2, target: 10 },
  { id: "deep-1", series: "deep", title: "Trabajo profundo", description: "Una sesión de 50 minutos o más (medida con temporizador).", icon: "brain", tier: 1, target: 1 },
  { id: "deep-10", series: "deep", title: "Mente de acero", description: "10 sesiones de 50 minutos o más.", icon: "brain", tier: 3, target: 10 },
  { id: "hours-10", series: "hours", title: "10 horas", description: "Acumula 10 horas de concentración.", icon: "clock", tier: 1, target: 10 },
  { id: "hours-50", series: "hours", title: "50 horas", description: "Acumula 50 horas de concentración.", icon: "clock", tier: 2, target: 50 },
  { id: "hours-100", series: "hours", title: "100 horas", description: "Acumula 100 horas de concentración.", icon: "clock", tier: 3, target: 100 },
  { id: "hours-500", series: "hours", title: "500 horas", description: "Acumula 500 horas de concentración.", icon: "clock", tier: 4, target: 500 },
  { id: "tasks-1", series: "tasks", title: "Primera tarea", description: "Completa tu primera tarea.", icon: "check", tier: 1, target: 1 },
  { id: "tasks-50", series: "tasks", title: "50 tareas", description: "Completa 50 tareas.", icon: "check", tier: 2, target: 50 },
  { id: "tasks-250", series: "tasks", title: "250 tareas", description: "Completa 250 tareas.", icon: "check", tier: 3, target: 250 },
  { id: "tasks-1000", series: "tasks", title: "1000 tareas", description: "Completa 1000 tareas.", icon: "check", tier: 4, target: 1000 },
  { id: "habits-30", series: "habits", title: "Hábito en marcha", description: "Cumple hábitos 30 veces.", icon: "calendar", tier: 2, target: 30 },
  { id: "habits-100", series: "habits", title: "Hábitos de hierro", description: "Cumple hábitos 100 veces.", icon: "calendar", tier: 3, target: 100 },
  { id: "streak-3", series: "streak", title: "Tres seguidos", description: "3 días seguidos con actividad (los descansos no rompen la racha).", icon: "flame", tier: 1, target: 3 },
  { id: "streak-7", series: "streak", title: "Semana completa", description: "Racha de 7 días.", icon: "flame", tier: 2, target: 7 },
  { id: "streak-30", series: "streak", title: "Un mes constante", description: "Racha de 30 días.", icon: "flame", tier: 3, target: 30 },
  { id: "streak-100", series: "streak", title: "Cien días", description: "Racha de 100 días.", icon: "flame", tier: 4, target: 100 },
  { id: "weeks-4", series: "weeks", title: "Cuatro semanas constantes", description: "4 semanas con al menos 4 días activos.", icon: "star", tier: 2, target: 4 },
  { id: "early-5", series: "early", title: "Madrugador", description: "5 sesiones empezadas antes de las 8:00.", icon: "sunrise", tier: 2, target: 5 },
  { id: "night-5", series: "night", title: "Búho", description: "5 sesiones empezadas a partir de las 22:00.", icon: "moon", tier: 2, target: 5 },
  { id: "comeback", series: "comeback", title: "Volver también cuenta", description: "Retoma la actividad tras 7 días o más sin registrar nada.", icon: "undo", tier: 2, target: 1 },
  { id: "goal-1", series: "goals", title: "Meta cumplida", description: "Alcanza un objetivo o desafío medible.", icon: "target", tier: 1, target: 1 },
  { id: "goal-10", series: "goals", title: "Cumplidor", description: "Alcanza 10 objetivos o desafíos.", icon: "target", tier: 3, target: 10 },
  { id: "estimates-10", series: "estimates", title: "Buen estimador", description: "10 tareas terminadas con un tiempo real a ±20 % de lo estimado.", icon: "gauge", tier: 2, target: 10 },
];

/**
 * Logros derivados de los datos. Cada serie es una lista ordenada de (día, incremento); el logro se
 * desbloquea el día en que el acumulado alcanza su meta.
 */
export function achievements(src: XpSources, xp: XpResult, tz: string, today: ISODate, weekStartsOn = 1): Achievement[] {
  const series = new Map<string, { day: ISODate; v: number }[]>();
  const push = (k: string, day: ISODate, v = 1) => {
    const arr = series.get(k) ?? [];
    arr.push({ day, v });
    series.set(k, arr);
  };
  for (const s of src.sessions) {
    const z = zonedParts(new Date(s.started_at), tz);
    if (z.date > today) continue;
    push("sessions", z.date);
    push("hours", z.date, s.focus_seconds / 3600);
    if (s.kind === "just_start" && s.focus_seconds >= XP_RULES.justStartMinSeconds) push("just", z.date);
    if (s.kind !== "manual" && s.focus_seconds >= 50 * 60) push("deep", z.date);
    if (s.kind !== "manual" && s.focus_seconds >= 600) {
      if (z.hour < 8) push("early", z.date);
      if (z.hour >= 22) push("night", z.date);
    }
  }
  for (const t of src.tasks) {
    if (!taskEligible(t)) continue;
    const day = zonedParts(new Date(t.completed_at), tz).date;
    if (day > today) continue;
    push("tasks", day);
    if (t.estimated_minutes && t.actual_seconds >= 300) {
      const r = t.actual_seconds / (t.estimated_minutes * 60);
      if (r >= 0.8 && r <= 1.2) push("estimates", day);
    }
  }
  for (const l of src.habitLogs) if (l.log_date <= today) push("habits", l.log_date);
  for (const g of goalAchievements(src, xp.facts, tz, today, weekStartsOn)) push("goals", g.day);

  // Rachas (máxima alcanzada), regresos y semanas constantes, recorriendo los días en orden.
  const rest = new Set(src.restDays);
  const activeDays = [...xp.facts].filter(([, f]) => isActive(f)).map(([d]) => d).sort();
  let run = 0;
  let best = 0;
  let prev: ISODate | null = null;
  const weekActive = new Map<ISODate, number>();
  for (const d of activeDays) {
    if (prev) {
      let gapRestOnly = true;
      for (let x = addDays(prev, 1); x < d; x = addDays(x, 1)) if (!rest.has(x)) gapRestOnly = false;
      run = gapRestOnly ? run + 1 : 1;
      if (diffDays(d, prev) > 7) push("comeback", d);
    } else run = 1;
    if (run > best) {
      for (let k = best + 1; k <= run; k++) push("streak", d);
      best = run;
    }
    prev = d;
    const w = startOfWeek(d, weekStartsOn);
    const n = (weekActive.get(w) ?? 0) + 1;
    weekActive.set(w, n);
    if (n === XP_RULES.consistentWeekDays) push("weeks", d);
  }

  return DEFS.map(({ series: key, ...def }) => {
    const arr = (series.get(key) ?? []).sort((a, b) => (a.day < b.day ? -1 : 1));
    let acc = 0;
    let unlockedAt: ISODate | null = null;
    for (const p of arr) {
      acc += p.v;
      if (!unlockedAt && acc >= def.target - 1e-9) unlockedAt = p.day;
    }
    return { ...def, current: Math.min(def.target, key === "hours" ? Math.floor(acc * 10) / 10 : acc), unlockedAt };
  });
}

// ---------------------------------------------------------------------------
// Desafíos personales sugeridos (ajustados a tu propio ritmo)
// ---------------------------------------------------------------------------

export type ChallengeSuggestion = {
  key: string;
  title: string;
  description: string;
  metric: Exclude<GoalMetric, "manual">;
  target: number;
  days: number;
  xp: number;
};

/**
 * Propone desafíos de 7 días a partir de tu media de las últimas 4 semanas, un poco por encima (≈ +10 %)
 * para que sean alcanzables. Si aún no hay historial, propone metas de inicio pequeñas.
 */
export function suggestChallenges(facts: Map<ISODate, DayFacts>, today: ISODate, hasHabits: boolean): ChallengeSuggestion[] {
  const from = addDays(today, -27);
  let focus = 0;
  let tasks = 0;
  let habits = 0;
  let active = 0;
  for (const [d, f] of facts) {
    if (d < from || d > today) continue;
    focus += f.focusSeconds / 60;
    tasks += f.tasks;
    habits += f.habits;
    if (isActive(f)) active++;
  }
  const weekly = (v: number) => v / 4;
  const xp = Math.min(XP_RULES.goalCustomMax, XP_RULES.goalCustomPerDay * 7);
  const roundTo = (v: number, step: number) => Math.max(step, Math.round(v / step) * step);
  const out: ChallengeSuggestion[] = [];
  const focusTarget = active ? Math.max(60, roundTo(weekly(focus) * 1.1, 15)) : 60;
  out.push({
    key: "focus",
    title: active ? `Semana de foco: ${focusTarget} min` : "Primera hora de foco",
    description: active ? `Tu media es de ${Math.round(weekly(focus))} min por semana. Supérala un poco en los próximos 7 días.` : "Suma 60 minutos de concentración en 7 días, aunque sea en sesiones cortas.",
    metric: "focus_minutes",
    target: focusTarget,
    days: 7,
    xp,
  });
  const taskTarget = Math.max(3, Math.round(weekly(tasks) * 1.1));
  out.push({
    key: "tasks",
    title: `Cierra ${taskTarget} tareas`,
    description: tasks ? `Sueles completar ${Math.round(weekly(tasks))} por semana. Termina ${taskTarget} en los próximos 7 días.` : "Elige tareas pequeñas y termínalas en los próximos 7 días.",
    metric: "tasks_completed",
    target: taskTarget,
    days: 7,
    xp,
  });
  if (hasHabits) {
    const habitTarget = Math.max(3, Math.round(weekly(habits) * 1.1));
    out.push({
      key: "habits",
      title: `${habitTarget} hábitos en 7 días`,
      description: habits ? `Tu media es de ${Math.round(weekly(habits))} por semana.` : "Marca tus hábitos cumplidos durante una semana.",
      metric: "habit_completions",
      target: habitTarget,
      days: 7,
      xp,
    });
  }
  return out;
}
