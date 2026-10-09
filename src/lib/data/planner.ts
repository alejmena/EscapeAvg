import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { addDays, localHour, startOfWeek, type ISODate } from "@/lib/domain/dates";
import { isScheduled } from "@/lib/domain/habits";
import { estimateAccuracy } from "@/lib/domain/stats";
import { bestBlock } from "@/lib/domain/analytics";
import { sumXp } from "@/lib/domain/gamification";
import { ruleBasedPlanner, type DayPlan, type PlannerTask, type WeeklyReview } from "@/lib/domain/planner";
import type { Habit, HabitLog, Profile } from "@/lib/types";
import { getByCategory, getDaily, getHabitCompliance } from "./stats";
import { getRestDays, getSessionPoints } from "./analytics";
import { getProgress } from "./gamification";

/** Proveedor activo. Hoy es el de reglas; un proveedor con IA implementará la misma interfaz. */
const provider = ruleBasedPlanner;

const TASK_FIELDS = "*";

export async function getDayPlan(supabase: ServerSupabase, profile: Profile, today: ISODate): Promise<DayPlan> {
  const tz = profile.timezone;
  const [tasksRes, estimatedRes, daily, sessions, habitsRes, logsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_FIELDS)
      .is("parent_id", null)
      .in("status", ["todo", "in_progress"])
      .order("priority", { ascending: false })
      .limit(200),
    supabase
      .from("tasks")
      .select("estimated_minutes, actual_seconds")
      .eq("status", "done")
      .not("estimated_minutes", "is", null)
      .gt("actual_seconds", 59)
      .order("completed_at", { ascending: false })
      .limit(50),
    getDaily(supabase, addDays(today, -28), today),
    getSessionPoints(supabase, addDays(today, -41), today, tz),
    supabase.from("habits").select("*").is("archived_at", null).order("position"),
    supabase.from("habit_logs").select("habit_id, status").eq("log_date", today),
  ]);
  const logged = new Set(((logsRes.data ?? []) as Pick<HabitLog, "habit_id" | "status">[]).map((l) => l.habit_id));
  const acc = estimateAccuracy((estimatedRes.data ?? []) as { estimated_minutes: number | null; actual_seconds: number }[]);
  return provider.planDay({
    today,
    hour: localHour(new Date(), tz),
    tasks: (tasksRes.data ?? []) as PlannerTask[],
    daily,
    estimateRatio: acc && acc.sample >= 3 ? acc.ratio : null,
    bestBlockStart: bestBlock(sessions, tz)?.start ?? null,
    pendingHabits: ((habitsRes.data ?? []) as Habit[]).filter((h) => isScheduled(h, today) && !logged.has(h.id)).map((h) => ({ id: h.id, name: h.name })),
  });
}

export type ReviewWeek = "last" | "current";

export async function getWeeklyReview(
  supabase: ServerSupabase,
  profile: Profile,
  today: ISODate,
  which: ReviewWeek,
): Promise<{ review: WeeklyReview; from: ISODate; to: ISODate }> {
  const tz = profile.timezone;
  const thisWeek = startOfWeek(today, profile.week_starts_on);
  const from = which === "current" ? thisWeek : addDays(thisWeek, -7);
  const to = which === "current" ? today : addDays(thisWeek, -1);
  const span = Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
  const prevFrom = addDays(from, -7);

  const [daily, previousDaily, restDays, categories, compliance, sessions, progress, goalsRes, postponed] = await Promise.all([
    getDaily(supabase, from, to),
    getDaily(supabase, prevFrom, addDays(prevFrom, span)),
    getRestDays(supabase, from),
    getByCategory(supabase, from, to),
    getHabitCompliance(supabase, from, to, today, profile.week_starts_on),
    getSessionPoints(supabase, from, to, tz),
    getProgress(supabase, tz, today, profile.week_starts_on),
    supabase.from("goals").select("title, metric, period, target_value, category_id, created_at").eq("status", "active").eq("period", "weekly").is("category_id", null),
    supabase.from("tasks").select("id", { count: "exact", head: true }).in("status", ["todo", "in_progress"]).gte("postponed_count", 2),
  ]);

  const sums = {
    focus_minutes: daily.reduce((a, d) => a + d.focus_seconds, 0) / 60,
    tasks_completed: daily.reduce((a, d) => a + d.tasks_completed, 0),
    habit_completions: daily.reduce((a, d) => a + d.habits_done, 0),
  } as Record<string, number>;
  type GoalRow = { title: string; metric: string; target_value: number; created_at: string };
  // Objetivos semanales medibles que ya existían esa semana; los de la semana en curso solo cuentan si ya se cumplieron.
  const weeklyGoals = ((goalsRes.data ?? []) as GoalRow[])
    .filter((g) => g.metric !== "manual" && g.created_at.slice(0, 10) <= to)
    .map((g) => ({ title: g.title, achieved: (sums[g.metric] ?? 0) >= Number(g.target_value) }))
    .filter((g) => which === "last" || g.achieved);
  const challenges = progress.xp.goals.filter((g) => g.day >= from && g.day <= to && !weeklyGoals.some((w) => w.title === g.title));

  const review = await provider.weeklyReview({
    week: { from, to },
    daily,
    previousDaily,
    restDays: restDays.filter((d) => d <= to).length,
    topCategory: categories[0] && categories[0].focus_seconds > 0 ? { name: categories[0].name, focus_seconds: categories[0].focus_seconds } : null,
    habitCompliance: compliance.rate,
    goals: [...weeklyGoals, ...challenges.map((c) => ({ title: c.title, achieved: true }))],
    xp: sumXp(progress.xp.byDay, from, to),
    longestSessionSeconds: Math.max(0, ...sessions.filter((s) => s.status === "completed").map((s) => s.focus_seconds)),
    postponedOpen: postponed.count ?? 0,
  });
  return { review, from, to };
}
