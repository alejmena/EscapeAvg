import "server-only";
import { cache } from "react";
import type { ServerSupabase } from "@/lib/supabase/server";
import { addDays, type ISODate, zonedDayStart } from "@/lib/domain/dates";
import { type ActivitySession, aggregateDays, type CategoryInfo, type DayTotals, normalizeGoal, DEFAULT_GOAL_MINUTES } from "@/lib/domain/discipline";
import type { Profile } from "@/lib/types";

/**
 * ¿Está aplicada la migración del sistema de disciplina? Hasta que alejandro la pegue en Supabase,
 * la app sigue funcionando: los rangos se calculan con la categoría de la tarea y el objetivo por defecto.
 */
export const isDisciplineReady = cache(async (supabase: ServerSupabase): Promise<boolean> => {
  const { error } = await supabase.from("favorite_quotes").select("quote_id", { count: "exact", head: true });
  return !error;
});

export function dailyGoal(profile: Profile): number {
  return profile.daily_goal_minutes == null ? DEFAULT_GOAL_MINUTES : normalizeGoal(profile.daily_goal_minutes);
}

export async function getCategories(supabase: ServerSupabase, ready: boolean): Promise<(CategoryInfo & { position: number })[]> {
  const { data } = await supabase
    .from("categories")
    .select(ready ? "id, name, color, position, counts_as_development" : "id, name, color, position")
    .is("archived_at", null)
    .order("position");
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((c) => ({
    id: String(c.id),
    name: String(c.name),
    color: String(c.color),
    position: Number(c.position),
    counts: c.counts_as_development !== false,
  }));
}

type Raw = Omit<ActivitySession, "category_id" | "quality"> & {
  category_id?: string | null;
  quality?: number | null;
  task: { category_id: string | null } | { category_id: string | null }[] | null;
};

/** Actividades completadas (sin descansos) que empezaron entre los días locales `from` y `to`. */
export async function getActivities(supabase: ServerSupabase, ready: boolean, timezone: string, from: ISODate, to: ISODate): Promise<ActivitySession[]> {
  const cols = `started_at, ended_at, focus_seconds, kind, status, ${ready ? "category_id, quality, " : ""}task:tasks(category_id)`;
  const t0 = zonedDayStart(from, timezone);
  const t1 = zonedDayStart(addDays(to, 1), timezone);
  const out: ActivitySession[] = [];
  const PAGE = 1000;
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase
      .from("focus_sessions")
      .select(cols)
      .eq("status", "completed")
      .neq("kind", "break")
      .gte("started_at", t0)
      .lt("started_at", t1)
      .order("started_at")
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as Raw[];
    for (const r of rows) {
      const task = Array.isArray(r.task) ? r.task[0] : r.task;
      out.push({
        started_at: r.started_at,
        ended_at: r.ended_at,
        focus_seconds: r.focus_seconds,
        kind: r.kind,
        status: r.status,
        category_id: r.category_id ?? task?.category_id ?? null,
        quality: r.quality ?? null,
      });
    }
    if (rows.length < PAGE) break;
  }
  return out;
}

export async function getRestDaySet(supabase: ServerSupabase, from: ISODate): Promise<Set<ISODate>> {
  const { data } = await supabase.from("rest_days").select("day").gte("day", from);
  return new Set(((data ?? []) as { day: string }[]).map((r) => r.day));
}

export type DisciplineData = {
  ready: boolean;
  goalMinutes: number;
  categories: (CategoryInfo & { position: number })[];
  days: Map<ISODate, DayTotals>;
  restDays: Set<ISODate>;
};

/** Todo lo necesario para rangos y estadísticas de desarrollo entre `from` y hoy. */
export async function getDiscipline(supabase: ServerSupabase, profile: Profile, from: ISODate, today: ISODate): Promise<DisciplineData> {
  const ready = await isDisciplineReady(supabase);
  const [categories, sessions, restDays] = await Promise.all([
    getCategories(supabase, ready),
    getActivities(supabase, ready, profile.timezone, from, today),
    getRestDaySet(supabase, from),
  ]);
  return {
    ready,
    goalMinutes: ready ? dailyGoal(profile) : DEFAULT_GOAL_MINUTES,
    categories,
    days: aggregateDays(sessions, profile.timezone, categories),
    restDays,
  };
}

export async function getFavoriteQuoteIds(supabase: ServerSupabase, ready: boolean): Promise<string[]> {
  if (!ready) return [];
  const { data } = await supabase.from("favorite_quotes").select("quote_id").order("created_at", { ascending: false });
  return ((data ?? []) as { quote_id: string }[]).map((r) => r.quote_id);
}
