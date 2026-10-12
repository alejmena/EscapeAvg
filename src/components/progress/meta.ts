import { CalendarCheck, CalendarRange, CheckSquare, Flame, Target, Timer, Zap } from "lucide-react";
import type { XpSource } from "@/lib/domain/gamification";
import type { GoalMetric } from "@/lib/domain/goals";
import type { Tone } from "@/lib/sections";

/** Cada fuente de XP con el color e icono de su sección (Concentración, Tareas, Hábitos…). */
export const SOURCE_META: Record<XpSource, { tone: Tone; icon: typeof Zap }> = {
  focus: { tone: "coral", icon: Timer },
  just_start: { tone: "amber", icon: Zap },
  tasks: { tone: "blue", icon: CheckSquare },
  habits: { tone: "orange", icon: Flame },
  active_day: { tone: "teal", icon: CalendarCheck },
  consistency: { tone: "violet", icon: CalendarRange },
  goals: { tone: "green", icon: Target },
};

/** Desafíos: color e icono según lo que miden. */
export const METRIC_META: Record<Exclude<GoalMetric, "manual">, { tone: Tone; icon: typeof Zap }> = {
  focus_minutes: { tone: "coral", icon: Timer },
  tasks_completed: { tone: "blue", icon: CheckSquare },
  habit_completions: { tone: "orange", icon: Flame },
};

/** Categorías de los logros: del I (inicial) al IV (maestro). */
export const TIER_META: Record<1 | 2 | 3 | 4, { tone: Tone; label: string }> = {
  1: { tone: "teal", label: "Inicial" },
  2: { tone: "blue", label: "Avanzado" },
  3: { tone: "fuchsia", label: "Experto" },
  4: { tone: "gold", label: "Maestro" },
};
