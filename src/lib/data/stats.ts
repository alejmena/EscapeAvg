import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { addDays, type ISODate } from "@/lib/domain/dates";
import { consistencyStreak } from "@/lib/domain/streaks";
import type { DailyStat } from "@/lib/domain/stats";
import { goalProgress, goalRange, type GoalProgress } from "@/lib/domain/goals";
import { compliance, complianceTrend } from "@/lib/domain/habits";
import { ruleBasedProvider, type Recommendation } from "@/lib/domain/recommendations";
import type { Goal, Habit, HabitLog } from "@/lib/types";

export type CategoryStat = { category_id: string | null; name: string; color: string; focus_seconds: number; tasks_completed: number };
export type HourlyStat = { hour: number; focus_seconds: number; focus_sessions: number };

function normDaily(rows: Record<string, unknown>[] | null): DailyStat[] {
  return (rows ?? []).map((r) => ({
    day: String(r.day),
    focus_seconds: Number(r.focus_seconds),
    focus_sessions: Number(r.focus_sessions),
    interruptions: Number(r.interruptions),
    tasks_completed: Number(r.tasks_completed),
    habits_done: Number(r.habits_done),
  }));
}

export async function getDaily(supabase: ServerSupabase, from: ISODate, to: ISODate): Promise<DailyStat[]> {
  const { data, error } = await supabase.rpc("stats_daily", { p_from: from, p_to: to });
  if (error) throw error;
  return normDaily(data);
}

export async function getByCategory(supabase: ServerSupabase, from: ISODate, to: ISODate): Promise<CategoryStat[]> {
  const { data, error } = await supabase.rpc("stats_by_category", { p_from: from, p_to: to });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    category_id: (r.category_id as string) ?? null,
    name: String(r.name),
    color: String(r.color),
    focus_seconds: Number(r.focus_seconds),
    tasks_completed: Number(r.tasks_completed),
  }));
}

export async function getHourly(supabase: ServerSupabase, from: ISODate, to: ISODate): Promise<HourlyStat[]> {
  const { data, error } = await supabase.rpc("stats_hourly", { p_from: from, p_to: to });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    hour: Number(r.hour),
    focus_seconds: Number(r.focus_seconds),
    focus_sessions: Number(r.focus_sessions),
  }));
}

export async function getStreak(supabase: ServerSupabase, today: ISODate) {
  const from = addDays(today, -400);
  const [active, rest] = await Promise.all([
    supabase.rpc("active_days", { p_from: from, p_to: today }),
    supabase.from("rest_days").select("day").gte("day", from),
  ]);
  const activeDays = ((active.data ?? []) as { day: string }[]).map((r) => r.day);
  const restDays = ((rest.data ?? []) as { day: string }[]).map((r) => r.day);
  return { ...consistencyStreak(activeDays, restDays, today), restToday: restDays.includes(today) };
}

export type GoalWithProgress = Goal & { progress: GoalProgress; range: { from: ISODate; to: ISODate } };

export async function getGoalsWithProgress(supabase: ServerSupabase, today: ISODate, weekStartsOn: number): Promise<GoalWithProgress[]> {
  const { data } = await supabase.from("goals").select("*").eq("status", "active").order("created_at");
  const goals = (data ?? []) as Goal[];
  return Promise.all(
    goals.map(async (g) => {
      const range = goalRange(g, today, weekStartsOn);
      let measured = 0;
      if (g.metric !== "manual") {
        const to = range.to > today ? today : range.to;
        if (to >= range.from) {
          if (g.category_id && g.metric !== "habit_completions") {
            const cats = await getByCategory(supabase, range.from, to);
            const c = cats.find((x) => x.category_id === g.category_id);
            measured = g.metric === "focus_minutes" ? Math.floor((c?.focus_seconds ?? 0) / 60) : (c?.tasks_completed ?? 0);
          } else if (g.metric === "habit_completions" && g.category_id) {
            const { data: habits } = await supabase.from("habits").select("id").eq("category_id", g.category_id);
            const ids = (habits ?? []).map((h) => h.id as string);
            if (ids.length) {
              const { count } = await supabase
                .from("habit_logs")
                .select("id", { count: "exact", head: true })
                .in("habit_id", ids)
                .eq("status", "done")
                .gte("log_date", range.from)
                .lte("log_date", to);
              measured = count ?? 0;
            }
          } else {
            const days = await getDaily(supabase, range.from, to);
            measured = days.reduce(
              (a, d) =>
                a + (g.metric === "focus_minutes" ? d.focus_seconds / 60 : g.metric === "tasks_completed" ? d.tasks_completed : d.habits_done),
              0,
            );
            measured = Math.floor(measured);
          }
        }
      }
      return { ...g, range, progress: goalProgress(g, measured) };
    }),
  );
}

/** Reúne datos reales de los últimos días y aplica el motor de recomendaciones. */
export async function getRecommendations(supabase: ServerSupabase, today: ISODate): Promise<Recommendation[]> {
  const from14 = addDays(today, -13);
  const [postponed, estimated, hourly, habitsRes, logsRes, sessions, overdue, daily] = await Promise.all([
    supabase.from("tasks").select("id, title, postponed_count").neq("status", "done").gte("postponed_count", 2).order("postponed_count", { ascending: false }).limit(5),
    supabase.from("tasks").select("estimated_minutes, actual_seconds").eq("status", "done").not("estimated_minutes", "is", null).gt("actual_seconds", 59).order("completed_at", { ascending: false }).limit(50),
    getHourly(supabase, addDays(today, -59), today),
    supabase.from("habits").select("*").is("archived_at", null),
    supabase.from("habit_logs").select("habit_id, log_date, status").gte("log_date", addDays(today, -60)),
    supabase.from("focus_sessions").select("status, focus_seconds").in("status", ["completed", "abandoned"]).neq("kind", "break").gte("started_at", `${from14}T00:00:00Z`),
    supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "done").neq("status", "archived").lt("due_date", today).is("parent_id", null),
    getDaily(supabase, from14, today),
  ]);
  const logs = (logsRes.data ?? []) as Pick<HabitLog, "habit_id" | "log_date" | "status">[];
  const habitTrends = ((habitsRes.data ?? []) as Habit[]).map((h) => ({
    id: h.id,
    name: h.name,
    ...complianceTrend(h, logs.filter((l) => l.habit_id === h.id), today),
  }));
  const totalsDaily = daily.reduce(
    (a, d) => ({ i: a.i + d.interruptions, s: a.s + d.focus_sessions, active: a.active + (d.focus_seconds >= 60 || d.tasks_completed > 0 || d.habits_done > 0 ? 1 : 0) }),
    { i: 0, s: 0, active: 0 },
  );
  return ruleBasedProvider.recommend({
    postponedTasks: (postponed.data ?? []) as { id: string; title: string; postponed_count: number }[],
    completedTasksWithEstimates: (estimated.data ?? []) as { estimated_minutes: number | null; actual_seconds: number }[],
    hourly,
    habitTrends,
    recentSessions: ((sessions.data ?? []) as { status: "completed" | "abandoned"; focus_seconds: number | null }[]).map((s) => ({
      status: s.status,
      focus_seconds: s.focus_seconds ?? 0,
    })),
    overdueCount: overdue.count ?? 0,
    interruptionsLast14: totalsDaily.i,
    focusSessionsLast14: totalsDaily.s,
    activeDaysLast14: totalsDaily.active,
  });
}

/** Cumplimiento agregado de todos los hábitos activos en un rango. */
export async function getHabitCompliance(supabase: ServerSupabase, from: ISODate, to: ISODate, today: ISODate, weekStartsOn: number) {
  const [habitsRes, logsRes] = await Promise.all([
    supabase.from("habits").select("*").is("archived_at", null),
    supabase.from("habit_logs").select("habit_id, log_date, status").gte("log_date", from).lte("log_date", to),
  ]);
  const logs = (logsRes.data ?? []) as Pick<HabitLog, "habit_id" | "log_date" | "status">[];
  let expected = 0;
  let done = 0;
  for (const h of (habitsRes.data ?? []) as Habit[]) {
    const c = compliance(h, logs.filter((l) => l.habit_id === h.id), from, to, today, weekStartsOn);
    expected += c.expected;
    done += c.done;
  }
  return { expected, done, rate: expected ? done / expected : null };
}
