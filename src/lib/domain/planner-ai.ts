import { z } from "zod";
import { formatDuration } from "./stats";
import { dayBudget, rankTasks, type DayPlan, type PlanInput, type PlanItem, type ReviewInput, type WeeklyReview } from "./planner";

/**
 * Fase 5 — la parte de IA, sin red: qué se le envía al modelo y cómo se valida lo que devuelve.
 *
 * El modelo recibe exactamente los datos agregados que usa el proveedor por reglas, más el resultado de las reglas
 * como punto de partida. Solo puede elegir entre tus tareas reales y redactar; los números (ritmo, minutos hechos,
 * lo que vence) se calculan aquí. Si su respuesta no encaja con los datos, se usa el plan por reglas.
 */

export const AI_PLAN_SCHEMA = z.object({
  headline: z.string(),
  items: z.array(
    z.object({
      task_id: z.string(),
      minutes: z.number(),
      reason: z.string(),
      just_start: z.boolean(),
    }),
  ),
  tips: z.array(z.string()),
});
export type AiPlan = z.infer<typeof AI_PLAN_SCHEMA>;

export const AI_REVIEW_SCHEMA = z.object({
  headline: z.string(),
  wins: z.array(z.string()),
  improve: z.array(z.string()),
  next_week: z.array(z.string()),
});
export type AiReview = z.infer<typeof AI_REVIEW_SCHEMA>;

const PRINCIPLES = `Eres el planificador de Escape Average, una app en español para dejar de procrastinar y medir el progreso con datos reales.
Principios:
- Habla de tú, en español neutro, con frases cortas y concretas. Sin emojis ni signos de exclamación.
- Nada de culpa ni presión: el objetivo es ser constante, no heroico. Celebra lo que salió bien con datos.
- Usa solo los datos que recibes. No inventes cifras, tareas, fechas ni hábitos. Si citas un número, debe estar en los datos.
- Sé realista: tu ritmo habitual manda; mejor un plan que se cumple que uno ambicioso.
- Cada recomendación debe poder hacerse hoy o esta semana y ser específica (qué, cuándo, cuánto).`;

export const PLAN_SYSTEM = `${PRINCIPLES}

Tarea: proponer el plan de hoy a partir de las tareas candidatas.
- Elige como máximo 6 tareas de "candidates" usando su "id" exacto, en el orden en que conviene hacerlas.
- La suma de "minutes" no debe superar "remaining_minutes" (la primera tarea puede superarlo si sola no cabe). Parte de "minutes" de cada candidata; ajústalo solo si hay un motivo.
- Las candidatas con "must_do": true vencen hoy o ya vencieron: inclúyelas si caben; las que no quepan se mostrarán aparte para moverlas.
- "rule_plan" es el plan que proponen las reglas; mejóralo si tienes un motivo claro (agrupar tareas parecidas, empezar por algo corto para arrancar, aprovechar la mejor franja horaria).
- "reason": por qué está en el plan y en ese lugar, en menos de 70 caracteres.
- "just_start": true si conviene arrancar con 2 minutos (tarea muy pospuesta, larga o que da pereza). Normalmente solo la primera.
- "headline": una frase que resuma el plan del día (ritmo, cuántas tareas, cuánto tiempo).
- "tips": de 0 a 3 consejos breves y accionables basados en los datos (mejor franja, precisión de estimaciones, hábitos pendientes, lo que no cabe).
Si no hay candidatas, devuelve "items" vacío y una frase amable en "headline".`;

export const REVIEW_SCHEMA_HINT = `Tarea: redactar el resumen semanal comparando la semana con la anterior.
- "headline": una frase con lo esencial de la semana (días activos, concentración, tareas) y el cambio frente a la anterior si es notable.
- "wins": de 1 a 5 cosas que salieron bien, cada una con su dato.
- "improve": de 0 a 3 cosas para mejorar, formuladas como hipótesis o pregunta útil, nunca como reproche.
- "next_week": de 1 a 3 metas alcanzables para la siguiente semana, un poco por encima de esta (no el doble).
"rule_review" es el resumen que proponen las reglas: úsalo como base y mejora la redacción, el orden y la relevancia.`;

export const REVIEW_SYSTEM = `${PRINCIPLES}

${REVIEW_SCHEMA_HINT}`;

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

function clean(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function cleanList(list: string[], max: number, maxLen = 260): string[] {
  const out: string[] = [];
  for (const raw of list) {
    const t = clean(raw, maxLen);
    if (t && !out.includes(t)) out.push(t);
    if (out.length === max) break;
  }
  return out;
}

/** Datos que se envían al modelo para el plan del día (sin títulos de tareas cerradas ni nada que no use). */
export function planPrompt(input: PlanInput, base: DayPlan): string {
  const { cap, doneMinutes, remaining } = dayBudget(input);
  const candidates = rankTasks(input)
    .slice(0, 30)
    .map((r) => ({
      id: r.task.id,
      title: r.task.title,
      minutes: r.minutes,
      priority: r.task.priority,
      status: r.task.status,
      due_date: r.task.due_date,
      postponed: r.task.postponed_count,
      must_do: r.mustDo,
      facts: r.reasons,
    }));
  return JSON.stringify({
    today: input.today,
    hour_now: input.hour,
    capacity_minutes: cap.minutes,
    capacity_source: cap.source,
    done_minutes_today: doneMinutes,
    remaining_minutes: remaining,
    estimate_ratio: input.estimateRatio,
    best_block_start_hour: input.bestBlockStart,
    pending_habits: input.pendingHabits.map((h) => h.name),
    candidates,
    rule_plan: {
      headline: base.headline,
      items: base.items.map((i) => ({ id: i.task.id, minutes: i.minutes, just_start: i.justStart })),
      deferred: base.deferred.map((i) => i.task.id),
      tips: base.tips,
    },
  });
}

/**
 * Convierte la respuesta del modelo en un plan válido o devuelve null para usar el de reglas.
 * Solo acepta tareas candidatas, respeta tu ritmo y recalcula lo que no cabe.
 */
export function mergeAiPlan(input: PlanInput, base: DayPlan, ai: AiPlan): DayPlan | null {
  const ranked = new Map(rankTasks(input).map((r) => [r.task.id, r]));
  const remaining = base.remainingMinutes;
  const items: PlanItem[] = [];
  let used = 0;
  for (const it of ai.items) {
    const r = ranked.get(it.task_id);
    if (!r || items.some((i) => i.task.id === r.task.id)) continue;
    if (items.length === 6) break;
    // Ritmo del día cumplido: como en las reglas, solo entra lo que vence.
    if (remaining === 0 && !r.mustDo) continue;
    const minutes = Number.isFinite(it.minutes) ? Math.min(240, round5(it.minutes)) : r.minutes;
    if (items.length > 0 && used + minutes > remaining) continue;
    const reason = clean(it.reason, 80);
    items.push({ task: r.task, minutes, reasons: [...(reason ? [reason] : []), ...r.reasons.filter((x) => x !== reason)], justStart: it.just_start });
    used += minutes;
  }
  // Un plan vacío cuando las reglas sí encontraban qué hacer es señal de una respuesta mala.
  if (items.length === 0 && base.items.length > 0) return null;

  const chosen = new Set(items.map((i) => i.task.id));
  const deferred: PlanItem[] = [...ranked.values()]
    .filter((r) => r.mustDo && !chosen.has(r.task.id))
    .map((r) => ({ task: r.task, minutes: r.minutes, reasons: r.reasons, justStart: false }));

  const headline = clean(ai.headline, 220) || base.headline;
  return {
    ...base,
    items,
    deferred,
    plannedMinutes: items.reduce((a, i) => a + i.minutes, 0),
    headline,
    tips: cleanList(ai.tips, 3),
    source: "ai",
  };
}

export function reviewPrompt(input: ReviewInput, base: WeeklyReview): string {
  const totals = (days: ReviewInput["daily"]) => ({
    focus: formatDuration(days.reduce((a, d) => a + d.focus_seconds, 0)),
    focus_seconds: days.reduce((a, d) => a + d.focus_seconds, 0),
    tasks_completed: days.reduce((a, d) => a + d.tasks_completed, 0),
    habits_done: days.reduce((a, d) => a + d.habits_done, 0),
    focus_sessions: days.reduce((a, d) => a + d.focus_sessions, 0),
    interruptions: days.reduce((a, d) => a + d.interruptions, 0),
  });
  return JSON.stringify({
    week: input.week,
    days: input.daily.map((d) => ({ day: d.day, focus: formatDuration(d.focus_seconds), tasks: d.tasks_completed, habits: d.habits_done })),
    totals: totals(input.daily),
    previous_week_totals: totals(input.previousDaily),
    rest_days: input.restDays,
    top_category: input.topCategory ? { name: input.topCategory.name, focus: formatDuration(input.topCategory.focus_seconds) } : null,
    habit_compliance_pct: input.habitCompliance == null ? null : Math.round(input.habitCompliance * 100),
    goals: input.goals,
    xp: input.xp,
    longest_session: formatDuration(input.longestSessionSeconds),
    tasks_postponed_often: input.postponedOpen,
    rule_review: { headline: base.headline, wins: base.wins, improve: base.improve, next_week: base.nextWeek },
  });
}

export function mergeAiReview(base: WeeklyReview, ai: AiReview): WeeklyReview | null {
  const headline = clean(ai.headline, 260);
  if (!headline) return null;
  const nextWeek = cleanList(ai.next_week, 3);
  return {
    headline,
    wins: cleanList(ai.wins, 5),
    improve: cleanList(ai.improve, 3),
    nextWeek: nextWeek.length ? nextWeek : base.nextWeek,
    source: "ai",
  };
}
