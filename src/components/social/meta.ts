import { CalendarCheck, CheckSquare, Flame, Timer } from "lucide-react";
import type { SharedMetric } from "@/lib/domain/social";
import type { Tone } from "@/lib/sections";

/** Color e icono de cada métrica de los desafíos compartidos (los de su sección). */
export const SHARED_METRIC_META: Record<SharedMetric, { tone: Tone; icon: typeof Timer }> = {
  focus_minutes: { tone: "coral", icon: Timer },
  tasks_completed: { tone: "blue", icon: CheckSquare },
  habit_completions: { tone: "orange", icon: Flame },
  active_days: { tone: "teal", icon: CalendarCheck },
};
