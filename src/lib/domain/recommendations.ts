import { estimateAccuracy, formatDuration } from "./stats";

/**
 * Sistema inicial de recomendaciones basado en reglas y datos reales.
 * Cada recomendación incluye la evidencia que la justifica, para que sea transparente.
 * Un proveedor de IA (Fase 5) implementará la misma interfaz `RecommendationProvider`.
 */
export type Recommendation = {
  id: string;
  kind: "procrastination" | "best_time" | "habit_decline" | "estimates" | "small_start" | "interruptions" | "rest";
  title: string;
  body: string;
  evidence: string;
  action?: { label: string; href: string };
  priority: number;
};

export type RecommendationInput = {
  postponedTasks: { id: string; title: string; postponed_count: number }[];
  completedTasksWithEstimates: { estimated_minutes: number | null; actual_seconds: number }[];
  hourly: { hour: number; focus_seconds: number; focus_sessions: number }[];
  habitTrends: { id: string; name: string; recent: number | null; previous: number | null; delta: number | null }[];
  /** Sesiones de los últimos 14 días. */
  recentSessions: { status: "completed" | "abandoned"; focus_seconds: number }[];
  overdueCount: number;
  interruptionsLast14: number;
  focusSessionsLast14: number;
  activeDaysLast14: number;
};

export interface RecommendationProvider {
  recommend(input: RecommendationInput): Promise<Recommendation[]> | Recommendation[];
}

const pct = (v: number) => `${Math.round(v * 100)} %`;

export function ruleBasedRecommendations(input: RecommendationInput): Recommendation[] {
  const out: Recommendation[] = [];

  // 1. Tareas que se posponen a menudo.
  const postponed = input.postponedTasks.filter((t) => t.postponed_count >= 2).sort((a, b) => b.postponed_count - a.postponed_count);
  if (postponed.length) {
    const t = postponed[0];
    out.push({
      id: `postponed-${t.id}`,
      kind: "procrastination",
      title: `"${t.title}" se ha pospuesto ${t.postponed_count} veces`,
      body: "Cuando algo se aplaza varias veces suele ser porque el primer paso no está claro. Divídela en pasos de 5 minutos y empieza solo por el primero.",
      evidence: `Fecha límite movida hacia adelante ${t.postponed_count} veces.${postponed.length > 1 ? ` Otras ${postponed.length - 1} tareas también se han pospuesto.` : ""}`,
      action: { label: "Just Start con esta tarea", href: `/focus?task=${t.id}&just=5` },
      priority: 90,
    });
  }

  // 2. Dificultad para empezar: muchas sesiones abandonadas o tareas vencidas.
  const abandoned = input.recentSessions.filter((s) => s.status === "abandoned").length;
  const total = input.recentSessions.length;
  if ((total >= 4 && abandoned / total >= 0.4) || input.overdueCount >= 5) {
    out.push({
      id: "small-start",
      kind: "small_start",
      title: "Prueba objetivos más pequeños",
      body: "Empezar es lo más difícil. Una sesión de 2 minutos cuenta: muchas veces, una vez dentro, sigues.",
      evidence:
        total >= 4 && abandoned / total >= 0.4
          ? `${abandoned} de tus últimas ${total} sesiones se abandonaron antes de terminar.`
          : `Tienes ${input.overdueCount} tareas vencidas.`,
      action: { label: "Empezar 2 minutos", href: "/focus?just=2" },
      priority: 80,
    });
  }

  // 3. Hábitos que pierden constancia.
  for (const h of input.habitTrends) {
    if (h.delta !== null && h.delta <= -0.25 && h.previous !== null && h.previous >= 0.5) {
      out.push({
        id: `habit-${h.id}`,
        kind: "habit_decline",
        title: `"${h.name}" está perdiendo constancia`,
        body: "No pasa nada por bajar el ritmo. Si el objetivo es demasiado alto, redúcelo temporalmente para mantener el hábito vivo.",
        evidence: `Cumplimiento de los últimos 14 días: ${pct(h.recent ?? 0)} frente a ${pct(h.previous)} en los 14 anteriores.`,
        action: { label: "Revisar hábito", href: "/habits" },
        priority: 70,
      });
    }
  }

  // 4. Estimaciones vs. tiempo real.
  const acc = estimateAccuracy(input.completedTasksWithEstimates);
  if (acc && acc.sample >= 3 && (acc.ratio >= 1.3 || acc.ratio <= 0.7)) {
    const over = acc.ratio >= 1.3;
    out.push({
      id: "estimates",
      kind: "estimates",
      title: over ? "Tus tareas llevan más tiempo del estimado" : "Sobreestimas el tiempo de tus tareas",
      body: over
        ? `De media dedicas ${acc.ratio.toFixed(1)}× lo previsto. Planifica con ese margen para no sentir que vas tarde.`
        : `De media terminas en el ${Math.round(acc.ratio * 100)} % del tiempo estimado. Puedes planificar más con confianza.`,
      evidence: `Basado en ${acc.sample} tareas completadas con estimación y tiempo registrado.`,
      priority: 50,
    });
  }

  // 5. Mejor horario (solo con datos suficientes).
  const sessions = input.hourly.reduce((a, h) => a + h.focus_sessions, 0);
  if (sessions >= 8) {
    const blocks = [0, 1, 2, 3, 4, 5, 6, 7].map((b) => {
      const hours = input.hourly.filter((h) => Math.floor(h.hour / 3) === b);
      return {
        start: b * 3,
        secs: hours.reduce((a, h) => a + Number(h.focus_seconds), 0),
        n: hours.reduce((a, h) => a + h.focus_sessions, 0),
      };
    });
    const best = blocks.filter((b) => b.n >= 3).sort((a, b) => b.secs / b.n - a.secs / a.n)[0];
    if (best) {
      out.push({
        id: "best-time",
        kind: "best_time",
        title: `Te concentras mejor entre las ${best.start}:00 y las ${best.start + 3}:00`,
        body: "Reserva esa franja para la tarea más exigente del día.",
        evidence: `${best.n} sesiones en esa franja, con una media de ${formatDuration(best.secs / best.n)} por sesión.`,
        priority: 40,
      });
    }
  }

  // 6. Interrupciones.
  if (input.focusSessionsLast14 >= 5 && input.interruptionsLast14 / input.focusSessionsLast14 >= 1) {
    out.push({
      id: "interruptions",
      kind: "interruptions",
      title: "Muchas interrupciones por sesión",
      body: "Prueba el modo sin distracciones, silencia notificaciones y deja el móvil fuera de alcance durante la sesión.",
      evidence: `${input.interruptionsLast14} interrupciones en ${input.focusSessionsLast14} sesiones (últimos 14 días).`,
      action: { label: "Abrir modo concentración", href: "/focus" },
      priority: 45,
    });
  }

  // 7. Reconocer el descanso: mucha actividad seguida.
  if (input.activeDaysLast14 >= 14) {
    out.push({
      id: "rest",
      kind: "rest",
      title: "14 días seguidos con actividad",
      body: "Gran constancia. Descansar también es parte del progreso: puedes marcar un día de descanso sin perder tu racha.",
      evidence: "Actividad registrada los últimos 14 días.",
      priority: 20,
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}

export const ruleBasedProvider: RecommendationProvider = { recommend: ruleBasedRecommendations };
