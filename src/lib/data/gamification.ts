import "server-only";
import { cache } from "react";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { ISODate } from "@/lib/domain/dates";
import { achievements, computeXp, levelInfo, type XpGoal, type XpHabitLog, type XpSources, type XpTask } from "@/lib/domain/gamification";
import { paginate } from "@/lib/data/analytics";

/** Todo el historial que alimenta el XP. Se lee completo porque el XP se recalcula, no se almacena. */
export async function getXpSources(supabase: ServerSupabase): Promise<XpSources> {
  type SessionRow = { started_at: string; focus_seconds: number | null; kind: string; task: { category_id: string | null } | null };
  const [sessions, tasks, habitLogs, habitsRes, goalsRes, restRes] = await Promise.all([
    paginate<SessionRow>((a, b) =>
      supabase
        .from("focus_sessions")
        .select("started_at, focus_seconds, kind, task:tasks(category_id)")
        .eq("status", "completed")
        .neq("kind", "break")
        .order("started_at")
        .order("id")
        .range(a, b),
    ),
    paginate<XpTask>((a, b) =>
      supabase
        .from("tasks")
        .select("created_at, completed_at, actual_seconds, parent_id, category_id, estimated_minutes")
        .eq("status", "done")
        .not("completed_at", "is", null)
        .order("completed_at")
        .order("id")
        .range(a, b),
    ),
    paginate<XpHabitLog>((a, b) => supabase.from("habit_logs").select("log_date, habit_id").eq("status", "done").order("log_date").order("id").range(a, b)),
    supabase.from("habits").select("id, category_id"),
    supabase.from("goals").select("id, title, metric, period, start_date, end_date, target_value, category_id, created_at"),
    supabase.from("rest_days").select("day"),
  ]);
  return {
    sessions: sessions.map((s) => ({ started_at: s.started_at, focus_seconds: s.focus_seconds ?? 0, kind: s.kind, category_id: s.task?.category_id ?? null })),
    tasks,
    habitLogs,
    habitCategory: Object.fromEntries(((habitsRes.data ?? []) as { id: string; category_id: string | null }[]).map((h) => [h.id, h.category_id])),
    goals: ((goalsRes.data ?? []) as XpGoal[]).map((g) => ({ ...g, target_value: Number(g.target_value) })),
    restDays: ((restRes.data ?? []) as { day: string }[]).map((r) => r.day),
  };
}

/** XP, nivel y logros del usuario actual. Cacheado por petición. */
export const getProgress = cache(async (supabase: ServerSupabase, tz: string, today: ISODate, weekStartsOn: number) => {
  const sources = await getXpSources(supabase);
  const xp = computeXp(sources, tz, today, weekStartsOn);
  return { sources, xp, level: levelInfo(xp.total), achievements: achievements(sources, xp, tz, today, weekStartsOn) };
});
