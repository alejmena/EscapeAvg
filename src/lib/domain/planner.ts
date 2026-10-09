import { addDays, diffDays, weekday, type ISODate } from "./dates";
import { formatDuration, type DailyStat } from "./stats";

/**
 * Fase 5 — planificación inteligente.
 *
 * Proveedor por reglas, transparente y sin coste: cada decisión lleva su motivo. Un proveedor basado en un
 * modelo de lenguaje implementará la misma interfaz `PlannerProvider` y recibirá exactamente estos datos,
 * así la IA podrá enchufarse sin cambiar las pantallas.
 */

export type PlannerTask = {
  id: string;
  title: string;
  priority: number;
  status: string;
  due_date: ISODate | null;
  estimated_minutes: number | null;
  actual_seconds: number;
  postponed_count: number;
  project_id: string | null;
  created_at: string;
};

export type PlanInput = {
  today: ISODate;
  /** Hora local actual (0–23). */
  hour: number;
  tasks: PlannerTask[];
  /** Estadísticas diarias de (al menos) las últimas 4 semanas, incluido hoy. */
  daily: DailyStat[];
  /** Ratio tiempo real / estimado de tus tareas cerradas (null si no hay datos). */
  estimateRatio: number | null;
  /** Mejor franja de 3 h (hora de inicio) según tu historial. */
  bestBlockStart: number | null;
  /** Hábitos programados para hoy que aún no has marcado. */
  pendingHabits: { id: string; name: string }[];
};

export type PlanItem = {
  task: PlannerTask;
  minutes: number;
  reasons: string[];
  /** Empezar con un Just Start de 2 min (tarea pospuesta o que da pereza). */
  justStart: boolean;
};

export type DayPlan = {
  capacityMinutes: number;
  capacitySource: "history" | "weekday" | "default";
  doneMinutes: number;
  remainingMinutes: number;
  items: PlanItem[];
  /** Tareas con fecha hoy o vencidas que no caben: mejor moverlas conscientemente. */
  deferred: PlanItem[];
  plannedMinutes: number;
  headline: string;
  tips: string[];
  pendingHabits: { id: string; name: string }[];
};

const DEFAULT_TASK_MIN = 25;
const DEFAULT_CAPACITY = 60;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/**
 * Minutos de concentración realistas para hoy: mediana de tus días activos de las últimas 4 semanas,
 * ajustada por el día de la semana si hay al menos 2 datos de ese día.
 */
export function dailyCapacity(daily: DailyStat[], today: ISODate): { minutes: number; source: DayPlan["capacitySource"] } {
  const from = addDays(today, -28);
  const past = daily.filter((d) => d.day >= from && d.day < today && d.focus_seconds >= 300);
  if (past.length < 3) return { minutes: DEFAULT_CAPACITY, source: "default" };
  const all = median(past.map((d) => d.focus_seconds / 60));
  const sameDay = past.filter((d) => weekday(d.day) === weekday(today)).map((d) => d.focus_seconds / 60);
  if (sameDay.length >= 2) return { minutes: round5((all + median(sameDay)) / 2), source: "weekday" };
  return { minutes: round5(all), source: "history" };
}

/** Minutos que probablemente te llevará lo que queda de una tarea, corregido por tu precisión al estimar. */
export function taskMinutes(t: PlannerTask, estimateRatio: number | null): number {
  if (!t.estimated_minutes) return DEFAULT_TASK_MIN;
  const ratio = estimateRatio ? Math.min(3, Math.max(0.5, estimateRatio)) : 1;
  const left = t.estimated_minutes * ratio - t.actual_seconds / 60;
  return round5(Math.max(10, left));
}

/** Urgencia e importancia, con los motivos legibles que la justifican. */
export function scoreTask(t: PlannerTask, today: ISODate): { score: number; reasons: string[]; mustDo: boolean } {
  const reasons: string[] = [];
  let score = 0;
  let mustDo = false;
  if (t.due_date) {
    const days = diffDays(t.due_date, today);
    if (days < 0) {
      score += 40 + Math.min(20, -days * 4);
      reasons.push(-days === 1 ? "Venció ayer" : `Vencida hace ${-days} días`);
      mustDo = true;
    } else if (days === 0) {
      score += 40;
      reasons.push("Vence hoy");
      mustDo = true;
    } else if (days === 1) {
      score += 20;
      reasons.push("Vence mañana");
    } else if (days <= 3) {
      score += 10;
      reasons.push(`Vence en ${days} días`);
    }
  }
  if (t.priority > 0) {
    score += t.priority * 12;
    if (t.priority === 3) reasons.push("Prioridad alta");
  }
  if (t.status === "in_progress") {
    score += 15;
    reasons.push("Ya la empezaste");
  }
  if (t.postponed_count >= 2) {
    score += Math.min(20, t.postponed_count * 5);
    reasons.push(`Pospuesta ${t.postponed_count} veces`);
  }
  // Las tareas sin fecha ni prioridad envejecen poco a poco para no quedarse olvidadas.
  const age = diffDays(today, t.created_at.slice(0, 10));
  if (!t.due_date && t.priority === 0 && age >= 14) {
    score += Math.min(10, Math.floor(age / 14) * 3);
    reasons.push(`Creada hace ${age} días`);
  }
  return { score, reasons, mustDo };
}

function blockLabel(start: number) {
  return `${start}:00–${start + 3}:00`;
}

export function planDay(input: PlanInput): DayPlan {
  const { today } = input;
  const cap = dailyCapacity(input.daily, today);
  const doneMinutes = Math.round((input.daily.find((d) => d.day === today)?.focus_seconds ?? 0) / 60);
  // A partir de las 21 h queda poco día: no proponemos más de una hora.
  const lateCap = input.hour >= 21 ? 60 : input.hour >= 18 ? Math.round(cap.minutes * 0.6) : cap.minutes;
  const remaining = Math.max(0, Math.min(lateCap, cap.minutes - doneMinutes));

  const scored = input.tasks
    .filter((t) => t.status === "todo" || t.status === "in_progress")
    .map((t) => {
      const s = scoreTask(t, today);
      return { task: t, minutes: taskMinutes(t, input.estimateRatio), reasons: s.reasons, mustDo: s.mustDo, score: s.score, justStart: false };
    })
    .sort((a, b) => Number(b.mustDo) - Number(a.mustDo) || b.score - a.score || a.minutes - b.minutes);

  const items: PlanItem[] = [];
  const deferred: PlanItem[] = [];
  let used = 0;
  for (const s of scored) {
    const item = { task: s.task, minutes: s.minutes, reasons: s.reasons, justStart: false };
    if (items.length < 6 && (used + s.minutes <= remaining || items.length === 0)) {
      if (remaining === 0 && !s.mustDo) continue;
      items.push(item);
      used += s.minutes;
    } else if (s.mustDo) {
      deferred.push(item);
    }
  }

  // Si la primera tarea se ha pospuesto o es larga, empieza con 2 minutos: lo difícil es arrancar.
  const first = items[0];
  if (first && (first.task.postponed_count >= 2 || first.minutes >= 60)) first.justStart = true;

  const tips: string[] = [];
  if (deferred.length > 0) {
    tips.push(
      `Hoy tienes ${deferred.length} ${deferred.length === 1 ? "tarea con fecha que no cabe" : "tareas con fecha que no caben"} en tu ritmo habitual. Mejor mover su fecha ahora que arrastrarlas.`,
    );
  }
  if (input.bestBlockStart != null && first && input.hour < input.bestBlockStart + 3) {
    tips.push(`Tu mejor franja suele ser ${blockLabel(input.bestBlockStart)}: reserva ese rato para "${first.task.title}".`);
  }
  if (input.estimateRatio && input.estimateRatio >= 1.3) {
    tips.push(`Sueles tardar ${Math.round(input.estimateRatio * 10) / 10}× lo que estimas, así que ya hemos ampliado los tiempos.`);
  }
  if (cap.source === "default") {
    tips.push("Aún hay poco historial: partimos de 1 hora de concentración al día y lo ajustaremos con tus datos.");
  }

  const plannedMinutes = items.reduce((a, i) => a + i.minutes, 0);
  let headline: string;
  if (input.tasks.length === 0) headline = "No tienes tareas pendientes. Buen momento para planear la semana o descansar.";
  else if (remaining === 0) headline = `Ya hiciste ${formatDuration(doneMinutes * 60)} de concentración hoy, tu ritmo habitual. Lo que sigue es extra.`;
  else if (items.length === 0) headline = "Nada urgente hoy. Elige una tarea pequeña para mantener el ritmo.";
  else
    headline = `Con tu ritmo habitual (${formatDuration(cap.minutes * 60)} al día) te propongo ${items.length} ${items.length === 1 ? "tarea" : "tareas"} para unos ${formatDuration(plannedMinutes * 60)}.`;

  return {
    capacityMinutes: cap.minutes,
    capacitySource: cap.source,
    doneMinutes,
    remainingMinutes: remaining,
    items,
    deferred,
    plannedMinutes,
    headline,
    tips,
    pendingHabits: input.pendingHabits,
  };
}

// ---------------------------------------------------------------------------
// Resumen semanal
// ---------------------------------------------------------------------------

export type ReviewInput = {
  /** Semana analizada (completa) y la anterior, para comparar contigo mismo. */
  week: { from: ISODate; to: ISODate };
  daily: DailyStat[];
  previousDaily: DailyStat[];
  restDays: number;
  topCategory: { name: string; focus_seconds: number } | null;
  habitCompliance: number | null;
  goals: { title: string; achieved: boolean }[];
  xp: number;
  longestSessionSeconds: number;
  postponedOpen: number;
};

export type WeeklyReview = {
  headline: string;
  wins: string[];
  improve: string[];
  nextWeek: string[];
};

const WEEKDAY_NAME = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function sum(days: DailyStat[], k: keyof Omit<DailyStat, "day">) {
  return days.reduce((a, d) => a + d[k], 0);
}

function active(d: DailyStat) {
  return d.focus_seconds >= 60 || d.tasks_completed > 0 || d.habits_done > 0;
}

export function weeklyReview(input: ReviewInput): WeeklyReview {
  const days = input.daily;
  const focus = sum(days, "focus_seconds");
  const prevFocus = sum(input.previousDaily, "focus_seconds");
  const tasks = sum(days, "tasks_completed");
  const prevTasks = sum(input.previousDaily, "tasks_completed");
  const activeDays = days.filter(active).length;
  const prevActive = input.previousDaily.filter(active).length;
  const sessions = sum(days, "focus_sessions");
  const interruptions = sum(days, "interruptions");

  const wins: string[] = [];
  const improve: string[] = [];
  const nextWeek: string[] = [];

  if (activeDays === 0) {
    return {
      headline: "Semana en pausa: no registraste actividad.",
      wins: input.restDays > 0 ? [`Marcaste ${input.restDays} ${input.restDays === 1 ? "día" : "días"} de descanso: descansar también es parte del plan.`] : [],
      improve: [],
      nextWeek: ["Vuelve con algo pequeño: un Just Start de 2 minutos el primer día cuenta como volver."],
    };
  }

  const best = [...days].sort((a, b) => b.focus_seconds - a.focus_seconds)[0];
  const pctChange = prevFocus >= 1800 ? Math.round(((focus - prevFocus) / prevFocus) * 100) : null;

  let headline = `${activeDays} ${activeDays === 1 ? "día activo" : "días activos"}, ${formatDuration(focus)} de concentración y ${tasks} ${tasks === 1 ? "tarea completada" : "tareas completadas"}.`;
  if (pctChange != null && Math.abs(pctChange) >= 10) headline += ` Un ${Math.abs(pctChange)} % ${pctChange > 0 ? "más" : "menos"} de concentración que la semana anterior.`;

  if (activeDays > prevActive && prevActive > 0) wins.push(`Fuiste más constante: ${activeDays} días activos frente a ${prevActive}.`);
  else if (activeDays >= 5) wins.push(`Gran constancia: ${activeDays} de 7 días con actividad.`);
  if (pctChange != null && pctChange >= 10) wins.push(`Te concentraste ${formatDuration(focus)}, un ${pctChange} % más que la semana anterior.`);
  if (tasks > prevTasks && prevTasks > 0) wins.push(`Cerraste ${tasks} tareas (${tasks - prevTasks} más que la semana anterior).`);
  if (best && best.focus_seconds >= 1800) wins.push(`Tu mejor día fue el ${WEEKDAY_NAME[weekday(best.day)]}, con ${formatDuration(best.focus_seconds)} de concentración.`);
  if (input.longestSessionSeconds >= 45 * 60) wins.push(`Tu sesión más larga duró ${formatDuration(input.longestSessionSeconds)}.`);
  if (input.topCategory && input.topCategory.focus_seconds >= 1800) wins.push(`Dedicaste más tiempo a ${input.topCategory.name} (${formatDuration(input.topCategory.focus_seconds)}).`);
  const achieved = input.goals.filter((g) => g.achieved);
  if (achieved.length) wins.push(`Objetivos cumplidos: ${achieved.map((g) => g.title).join(", ")}.`);
  if (input.habitCompliance != null && input.habitCompliance >= 0.8) wins.push(`Cumpliste el ${Math.round(input.habitCompliance * 100)} % de tus hábitos.`);
  if (input.xp > 0) wins.push(`Ganaste ${input.xp} XP.`);

  if (pctChange != null && pctChange <= -20) improve.push(`La concentración bajó un ${-pctChange} % respecto a la semana anterior. ¿Fue una semana más cargada o faltó un momento fijo para concentrarte?`);
  if (activeDays <= 3) improve.push(`Solo ${activeDays} ${activeDays === 1 ? "día activo" : "días activos"}. Para la constancia ayuda más hacer poco cada día que mucho en un día.`);
  if (sessions >= 4 && interruptions / sessions >= 1) improve.push(`Tuviste ${interruptions} interrupciones en ${sessions} sesiones. Prueba el modo sin distracciones o silenciar el móvil.`);
  if (input.habitCompliance != null && input.habitCompliance < 0.5) improve.push(`Cumpliste el ${Math.round(input.habitCompliance * 100)} % de tus hábitos. Quizá alguno pide menos frecuencia o un objetivo más pequeño.`);
  const missed = input.goals.filter((g) => !g.achieved);
  if (missed.length) improve.push(`Objetivos que no llegaron: ${missed.map((g) => g.title).join(", ")}. Ajusta la meta si era demasiado alta.`);
  if (input.postponedOpen >= 3) improve.push(`Tienes ${input.postponedOpen} tareas que se han pospuesto varias veces. Divídelas en pasos de 5 minutos.`);

  // Propuesta concreta y alcanzable para la semana siguiente: un poco por encima de esta, no el doble.
  const targetDays = Math.min(7, Math.max(activeDays + 1, 4));
  nextWeek.push(`Apunta a ${targetDays} días activos, aunque algunos sean solo 10 minutos.`);
  if (focus >= 1800) nextWeek.push(`Mantén unas ${formatDuration(Math.round((focus * 1.1) / 300) * 300)} de concentración (+10 %).`);
  if (best && best.focus_seconds >= 1800) nextWeek.push(`Protege el ${WEEKDAY_NAME[weekday(best.day)]}: ese día te funciona bien para el trabajo profundo.`);
  if (input.postponedOpen > 0) nextWeek.push("Empieza el lunes por la tarea que más has pospuesto, con un Just Start de 2 minutos.");

  return { headline, wins: wins.slice(0, 5), improve: improve.slice(0, 3), nextWeek: nextWeek.slice(0, 3) };
}

export interface PlannerProvider {
  planDay(input: PlanInput): Promise<DayPlan> | DayPlan;
  weeklyReview(input: ReviewInput): Promise<WeeklyReview> | WeeklyReview;
}

export const ruleBasedPlanner: PlannerProvider = { planDay, weeklyReview };
