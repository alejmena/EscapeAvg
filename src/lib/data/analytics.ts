import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { addDays, localDate, type ISODate, zonedDayStart } from "@/lib/domain/dates";
import type { ProjectRow, ProjectTaskRow, SessionPoint } from "@/lib/domain/analytics";

/** PostgREST devuelve como máximo 1000 filas por petición en Supabase: paginamos. */
const PAGE = 1000;
const MAX_ROWS = 20_000;

async function paginate<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

/**
 * Sesiones de concentración (completadas y abandonadas, sin descansos) iniciadas en [from, to] en días locales,
 * con la categoría y el proyecto de su tarea.
 */
export async function getSessionPoints(supabase: ServerSupabase, from: ISODate, to: ISODate, tz: string): Promise<SessionPoint[]> {
  const t0 = zonedDayStart(from, tz);
  const t1 = zonedDayStart(addDays(to, 1), tz);
  type Row = { started_at: string; focus_seconds: number | null; status: "completed" | "abandoned"; task: { category_id: string | null; project_id: string | null } | null };
  const rows = await paginate<Row>((a, b) =>
    supabase
      .from("focus_sessions")
      .select("started_at, focus_seconds, status, task:tasks(category_id, project_id)")
      .in("status", ["completed", "abandoned"])
      .neq("kind", "break")
      .gte("started_at", t0)
      .lt("started_at", t1)
      .order("started_at")
      .order("id")
      .range(a, b),
  );
  return rows.map((r) => ({
    started_at: r.started_at,
    focus_seconds: r.focus_seconds ?? 0,
    status: r.status,
    category_id: r.task?.category_id ?? null,
    project_id: r.task?.project_id ?? null,
  }));
}

export async function getProjectData(supabase: ServerSupabase): Promise<{ projects: ProjectRow[]; tasks: ProjectTaskRow[] }> {
  const [projRes, tasks] = await Promise.all([
    supabase.from("projects").select("id, name, status, target_date, category_id, created_at").neq("status", "archived").order("created_at"),
    paginate<ProjectTaskRow>((a, b) =>
      supabase
        .from("tasks")
        .select("project_id, parent_id, status, completed_at, actual_seconds")
        .not("project_id", "is", null)
        .order("created_at")
        .order("id")
        .range(a, b),
    ),
  ]);
  if (projRes.error) throw projRes.error;
  return { projects: (projRes.data ?? []) as ProjectRow[], tasks };
}

/** Fecha local de alta de la cuenta: los períodos anteriores no cuentan como "sin actividad". */
export async function getAccountStart(supabase: ServerSupabase, tz: string): Promise<ISODate | undefined> {
  // RLS solo devuelve el perfil propio.
  const { data } = await supabase.from("profiles").select("created_at").maybeSingle<{ created_at: string }>();
  return data?.created_at ? localDate(new Date(data.created_at), tz) : undefined;
}

export async function getRestDays(supabase: ServerSupabase, from: ISODate): Promise<ISODate[]> {
  const { data } = await supabase.from("rest_days").select("day").gte("day", from);
  return ((data ?? []) as { day: string }[]).map((r) => r.day);
}

/** La sesión completada más larga de la historia (récord personal). */
export async function getLongestSession(supabase: ServerSupabase) {
  const { data } = await supabase
    .from("focus_sessions")
    .select("started_at, focus_seconds, kind")
    .eq("status", "completed")
    .neq("kind", "break")
    .order("focus_seconds", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<{ started_at: string; focus_seconds: number; kind: string }>();
  return data && data.focus_seconds > 0 ? data : null;
}
