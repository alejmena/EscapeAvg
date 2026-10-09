import { addDays, endOfMonth, type ISODate, startOfMonth, startOfWeek } from "./dates";

export type GoalMetric = "focus_minutes" | "tasks_completed" | "habit_completions" | "manual";
export type GoalPeriod = "weekly" | "monthly" | "custom";

export type GoalLike = {
  metric: GoalMetric;
  period: GoalPeriod;
  start_date: ISODate | null;
  end_date: ISODate | null;
  target_value: number;
  manual_value: number;
  category_id: string | null;
};

export function goalRange(goal: Pick<GoalLike, "period" | "start_date" | "end_date">, today: ISODate, weekStartsOn = 1) {
  if (goal.period === "weekly") {
    const from = startOfWeek(today, weekStartsOn);
    return { from, to: addDays(from, 6) };
  }
  if (goal.period === "monthly") return { from: startOfMonth(today), to: endOfMonth(today) };
  return { from: goal.start_date ?? today, to: goal.end_date ?? today };
}

export type GoalProgress = { value: number; target: number; ratio: number; achieved: boolean };

export function goalProgress(goal: GoalLike, measured: number): GoalProgress {
  const value = goal.metric === "manual" ? Number(goal.manual_value) : measured;
  const target = Number(goal.target_value);
  const ratio = target > 0 ? Math.min(1, value / target) : 0;
  return { value, target, ratio, achieved: value >= target };
}

export const GOAL_METRIC_LABEL: Record<GoalMetric, string> = {
  focus_minutes: "minutos de concentración",
  tasks_completed: "tareas completadas",
  habit_completions: "hábitos cumplidos",
  manual: "progreso manual",
};
