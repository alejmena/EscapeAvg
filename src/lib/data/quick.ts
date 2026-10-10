import "server-only";
import { cache } from "react";
import type { ServerSupabase } from "@/lib/supabase/server";
import { addDays, zonedDayStart, type ISODate } from "@/lib/domain/dates";
import { templatesDueToday, visibleToday } from "@/lib/domain/quick";
import type { Profile, QuickTask, QuickTemplate, ScheduleBlock } from "@/lib/types";

export const QUICK_FIELDS = "id, title, status, due_date, position, completed_at, quick_template_id, actual_seconds";

/**
 * ¿Está aplicada la migración de microtareas y horario? Antes de pegarla en Supabase la app sigue
 * funcionando igual y estas secciones muestran un aviso.
 */
export const isQuickReady = cache(async (supabase: ServerSupabase): Promise<boolean> => {
  const { error } = await supabase.from("tasks").select("quick").limit(1);
  return !error;
});

export type QuickToday = { ready: false } | { ready: true; tasks: QuickTask[]; templates: QuickTemplate[]; carryOver: boolean };

/**
 * Microtareas de hoy. Antes de leerlas aplica el reinicio diario (archiva las pendientes antiguas si así
 * lo configuraste) y crea las recurrentes que tocan hoy. Ambas operaciones son idempotentes.
 */
export async function getQuickToday(supabase: ServerSupabase, profile: Profile, today: ISODate): Promise<QuickToday> {
  if (!(await isQuickReady(supabase))) return { ready: false };
  const carryOver = profile.quick_tasks_carry_over ?? true;
  const dayStart = zonedDayStart(today, profile.timezone);

  if (!carryOver) {
    await supabase.from("tasks").update({ status: "archived" }).eq("quick", true).in("status", ["todo", "in_progress"]).lt("due_date", today);
  }

  const templates = ((await supabase.from("quick_task_templates").select("id, title, repeat_days, position, last_spawned_on").order("position").order("created_at")).data ??
    []) as (QuickTemplate & { last_spawned_on: string | null })[];
  const due = templatesDueToday(templates, today, new Set(templates.filter((t) => t.last_spawned_on === today).map((t) => t.id)));

  const load = async () =>
    ((await supabase
      .from("tasks")
      .select(QUICK_FIELDS)
      .eq("quick", true)
      .neq("status", "archived")
      .or(`status.in.(todo,in_progress),completed_at.gte."${dayStart}"`)
      .order("position")
      .limit(300)).data ?? []) as QuickTask[];

  let tasks = await load();
  if (due.length) {
    // Marca primero la plantilla: si borras la tarea de hoy, no vuelve a aparecer al recargar.
    const claimed = ((await supabase
      .from("quick_task_templates")
      .update({ last_spawned_on: today })
      .in("id", due.map((t) => t.id))
      .or(`last_spawned_on.is.null,last_spawned_on.lt.${today}`)
      .select("id")).data ?? []) as { id: string }[];
    const ids = new Set(claimed.map((c) => c.id));
    const top = tasks.reduce((m, t) => Math.max(m, t.position), 0);
    const rows = due
      .filter((t) => ids.has(t.id))
      .map((t, i) => ({ title: t.title, quick: true, due_date: today, quick_template_id: t.id, position: top + 1 + i }));
    if (rows.length) {
      await supabase.from("tasks").upsert(rows, { onConflict: "quick_template_id,due_date", ignoreDuplicates: true });
      tasks = await load();
    }
  }

  return {
    ready: true,
    tasks: visibleToday(tasks, today, profile.timezone, carryOver),
    templates: templates.map(({ id, title, repeat_days, position }) => ({ id, title, repeat_days, position })),
    carryOver,
  };
}

/** Microtareas completadas en los últimos `days` días (para el historial y la constancia). */
export async function getQuickHistory(supabase: ServerSupabase, profile: Profile, today: ISODate, days = 60) {
  const from = zonedDayStart(addDays(today, -(days - 1)), profile.timezone);
  const { data } = await supabase
    .from("tasks")
    .select("title, completed_at")
    .eq("quick", true)
    .eq("status", "done")
    .gte("completed_at", from)
    .order("completed_at", { ascending: false })
    .limit(2000);
  return (data ?? []) as { title: string; completed_at: string }[];
}

export async function getSchedule(supabase: ServerSupabase): Promise<ScheduleBlock[] | null> {
  if (!(await isQuickReady(supabase))) return null;
  const { data, error } = await supabase
    .from("schedule_blocks")
    .select("id, day_of_week, start_minute, end_minute, title, color, idea_key, note")
    .order("day_of_week")
    .order("start_minute");
  if (error) return null;
  return (data ?? []) as ScheduleBlock[];
}
