import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { addDays, diffDays, type ISODate } from "@/lib/domain/dates";
import { toSocialStat, type SocialStat } from "@/lib/domain/social";

/** La migración social aún no se ha aplicado (tabla o función inexistente). */
export class SocialSetupError extends Error {}

const MISSING = new Set(["42P01", "42883", "PGRST202", "PGRST205", "PGRST200"]);

function unwrap<T>(res: { data: T | null; error: { code?: string; message?: string } | null }): T {
  if (res.error) {
    if (res.error.code && MISSING.has(res.error.code)) throw new SocialSetupError(res.error.message);
    throw new Error(res.error.message ?? "db error");
  }
  return (res.data ?? []) as T;
}

export type FriendRow = {
  friendship_id: string;
  user_id: string;
  display_name: string | null;
  username: string | null;
  status: "pending" | "accepted";
  incoming: boolean;
  shares_stats: boolean;
  created_at: string;
};

export type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  invite_code: string;
  created_at: string;
};

export type MemberRow = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  role: "owner" | "member";
  shares_stats: boolean;
  joined_at: string;
};

export type SharedChallenge = {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  metric: "focus_minutes" | "tasks_completed" | "habit_completions" | "active_days";
  target_value: number;
  start_date: ISODate;
  end_date: ISODate;
  created_at: string;
};

export function personName(p: { display_name: string | null; username: string | null }): string {
  return p.display_name || (p.username ? `@${p.username}` : "Sin nombre");
}

export async function getFriends(supabase: ServerSupabase): Promise<FriendRow[]> {
  return unwrap(await supabase.rpc("list_friends")) as FriendRow[];
}

export async function getSocialStats(supabase: ServerSupabase, ids: string[], from: ISODate, to: ISODate): Promise<SocialStat[]> {
  if (ids.length === 0) return [];
  const rows = unwrap(await supabase.rpc("social_stats", { p_user_ids: ids, p_from: from, p_to: to })) as Record<string, unknown>[];
  return rows.map(toSocialStat);
}

/**
 * Período en curso (del inicio de la semana a hoy) y el mismo tramo de la semana anterior,
 * para comparar la mejora de cada persona consigo misma.
 */
export function weekRanges(today: ISODate, weekStart: ISODate) {
  const span = diffDays(today, weekStart);
  const prevFrom = addDays(weekStart, -7);
  return { current: { from: weekStart, to: today }, previous: { from: prevFrom, to: addDays(prevFrom, span) }, days: span + 1 };
}

export async function getComparison(supabase: ServerSupabase, ids: string[], today: ISODate, weekStart: ISODate) {
  const r = weekRanges(today, weekStart);
  const [current, previous] = await Promise.all([
    getSocialStats(supabase, ids, r.current.from, r.current.to),
    getSocialStats(supabase, ids, r.previous.from, r.previous.to),
  ]);
  return { current, previous, days: r.days };
}

export async function getMyGroups(supabase: ServerSupabase): Promise<(GroupRow & { members: number })[]> {
  const [groups, members] = await Promise.all([
    supabase.from("groups").select("id, name, description, owner_id, invite_code, created_at").order("created_at"),
    supabase.from("group_members").select("group_id"),
  ]);
  const g = unwrap(groups) as GroupRow[];
  const counts = new Map<string, number>();
  for (const m of unwrap(members) as { group_id: string }[]) counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);
  return g.map((x) => ({ ...x, members: counts.get(x.id) ?? 1 }));
}

export async function getGroup(supabase: ServerSupabase, id: string) {
  const [group, members, challenges] = await Promise.all([
    supabase.from("groups").select("id, name, description, owner_id, invite_code, created_at").eq("id", id).maybeSingle(),
    supabase.rpc("group_members_list", { p_group: id }),
    supabase.from("shared_challenges").select("*").eq("group_id", id).order("end_date", { ascending: false }).limit(30),
  ]);
  const g = unwrap(group) as GroupRow | null;
  if (!g || (Array.isArray(g) && g.length === 0)) return null;
  return {
    group: g,
    members: unwrap(members) as MemberRow[],
    challenges: unwrap(challenges) as SharedChallenge[],
  };
}

/** Número de solicitudes de amistad recibidas pendientes (0 si la función social no está activada). */
export async function getPendingRequests(supabase: ServerSupabase, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("friendships")
    .select("id", { count: "exact", head: true })
    .eq("addressee_id", userId)
    .eq("status", "pending");
  return error ? 0 : (count ?? 0);
}
