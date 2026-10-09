/**
 * Comparaciones sociales justas. Lógica pura: recibe agregados ya autorizados por la base de datos
 * (`social_stats`) y decide cómo ordenarlos y describirlos.
 *
 * Principios del plan original:
 * - Las personas tienen objetivos distintos: por defecto se compara la constancia (días activos) y el
 *   % del objetivo propio, no las horas totales.
 * - Solo posiciones dentro de tu grupo o tus amigos; nunca percentiles ("Top 1 %") sin una población
 *   de comparación suficiente y verificable.
 */

export type SocialStat = {
  user_id: string;
  focus_seconds: number;
  tasks_completed: number;
  habits_done: number;
  active_days: number;
  weekly_focus_goal_minutes: number;
};

export type RankMetric = "consistency" | "goal" | "improvement" | "focus" | "tasks";

export const RANK_METRICS: { key: RankMetric; label: string; hint: string }[] = [
  { key: "consistency", label: "Constancia", hint: "Días con actividad en el período." },
  { key: "goal", label: "% de su objetivo", hint: "Minutos de concentración frente al objetivo semanal que cada uno eligió." },
  { key: "improvement", label: "Mejora", hint: "Concentración frente al mismo tramo del período anterior de cada persona." },
  { key: "focus", label: "Concentración", hint: "Minutos de concentración medidos." },
  { key: "tasks", label: "Tareas", hint: "Tareas completadas." },
];

export const SHARED_METRICS = ["focus_minutes", "tasks_completed", "habit_completions", "active_days"] as const;
export type SharedMetric = (typeof SHARED_METRICS)[number];

export const SHARED_METRIC_LABEL: Record<SharedMetric, { label: string; unit: string }> = {
  focus_minutes: { label: "Minutos de concentración", unit: "min" },
  tasks_completed: { label: "Tareas completadas", unit: "tareas" },
  habit_completions: { label: "Hábitos cumplidos", unit: "hábitos" },
  active_days: { label: "Días activos", unit: "días" },
};

/** Normaliza filas que llegan de PostgREST (bigint como string). */
export function toSocialStat(row: Record<string, unknown>): SocialStat {
  return {
    user_id: String(row.user_id),
    focus_seconds: Number(row.focus_seconds) || 0,
    tasks_completed: Number(row.tasks_completed) || 0,
    habits_done: Number(row.habits_done) || 0,
    active_days: Number(row.active_days) || 0,
    weekly_focus_goal_minutes: Number(row.weekly_focus_goal_minutes) || 0,
  };
}

/** % del objetivo semanal de concentración (prorrateado por la duración del período). Null si no tiene objetivo. */
export function goalPct(s: SocialStat, periodDays = 7): number | null {
  if (s.weekly_focus_goal_minutes <= 0) return null;
  const target = (s.weekly_focus_goal_minutes * periodDays) / 7;
  return Math.round((s.focus_seconds / 60 / target) * 100);
}

/** Cambio relativo de concentración. Null si la base es demasiado pequeña (< 30 min) para que sea justo. */
export function improvementPct(current: SocialStat, previous: SocialStat | undefined): number | null {
  const prevMin = (previous?.focus_seconds ?? 0) / 60;
  if (prevMin < 30) return null;
  return Math.round(((current.focus_seconds / 60 - prevMin) / prevMin) * 100);
}

export type RankedRow = {
  stat: SocialStat;
  rank: number;
  value: number | null;
  goalPct: number | null;
  improvement: number | null;
};

function metricValue(metric: RankMetric, s: SocialStat, prev: SocialStat | undefined, periodDays: number): number | null {
  switch (metric) {
    case "consistency":
      return s.active_days;
    case "goal":
      return goalPct(s, periodDays);
    case "improvement":
      return improvementPct(s, prev);
    case "focus":
      return Math.round(s.focus_seconds / 60);
    case "tasks":
      return s.tasks_completed;
  }
}

/**
 * Ordena por la métrica elegida. Empates comparten posición ("1, 1, 3"). Quien no tiene valor
 * (sin objetivo, o sin base para medir mejora) va al final sin posición.
 * Desempate de constancia: % del objetivo y luego minutos.
 */
export function rank(
  current: SocialStat[],
  previous: SocialStat[],
  metric: RankMetric,
  periodDays = 7,
): RankedRow[] {
  const prevBy = new Map(previous.map((p) => [p.user_id, p]));
  const rows = current.map((s) => {
    const prev = prevBy.get(s.user_id);
    return {
      stat: s,
      rank: 0,
      value: metricValue(metric, s, prev, periodDays),
      goalPct: goalPct(s, periodDays),
      improvement: improvementPct(s, prev),
    };
  });
  const key = (r: RankedRow): number[] =>
    metric === "consistency" ? [r.value ?? -1, r.goalPct ?? -1, r.stat.focus_seconds] : [r.value ?? -Infinity];
  const cmp = (a: RankedRow, b: RankedRow) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i];
    return 0;
  };
  const ranked = rows.filter((r) => r.value != null).sort(cmp);
  ranked.forEach((r, i) => {
    r.rank = i > 0 && cmp(ranked[i - 1], r) === 0 ? ranked[i - 1].rank : i + 1;
  });
  const unranked = rows.filter((r) => r.value == null).sort((a, b) => b.stat.active_days - a.stat.active_days);
  return [...ranked, ...unranked];
}

/** Valor de una persona para un desafío compartido. */
export function challengeValue(metric: SharedMetric, s: SocialStat | undefined): number {
  if (!s) return 0;
  switch (metric) {
    case "focus_minutes":
      return Math.floor(s.focus_seconds / 60);
    case "tasks_completed":
      return s.tasks_completed;
    case "habit_completions":
      return s.habits_done;
    case "active_days":
      return s.active_days;
  }
}

export type ChallengeState = "upcoming" | "active" | "finished";

export function challengeState(start: string, end: string, today: string): ChallengeState {
  if (today < start) return "upcoming";
  if (today > end) return "finished";
  return "active";
}

/** Frase motivadora sin presión: cuántas personas del grupo alcanzaron la meta. */
export function challengeSummary(values: number[], target: number): string {
  const done = values.filter((v) => v >= target).length;
  if (values.length === 0) return "Nadie comparte estadísticas todavía.";
  if (done === values.length) return values.length === 1 ? "¡Meta alcanzada!" : "¡Todos alcanzaron la meta!";
  if (done === 0) return "Nadie ha llegado todavía: cada paso cuenta.";
  return `${done} de ${values.length} ya alcanzaron la meta.`;
}

export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

/** Sugerencia de nombre de usuario a partir del nombre visible o el email. */
export function suggestUsername(displayName: string | null, email: string): string {
  const base = (displayName || email.split("@")[0] || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  return base.length >= 3 ? base : `${base}_${Math.random().toString(36).slice(2, 6)}`.replace(/^_/, "u_");
}
