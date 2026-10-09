import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/supabase/env";
import { localDate } from "@/lib/domain/dates";
import type { Profile } from "@/lib/types";

/**
 * Usuario autenticado + perfil para Server Components y Server Actions.
 * Redirige a /login si no hay sesión. Cacheado por petición.
 */
export const requireUser = cache(async () => {
  if (!supabaseEnv()) redirect("/setup");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  const safeProfile: Profile = profile ?? {
    id: user.id,
    display_name: null,
    username: null,
    timezone: "UTC",
    week_starts_on: 1,
    pomodoro_settings: {},
    weekly_focus_goal_minutes: 600,
    streaks_enabled: true,
    share_stats: false,
  };
  const today = localDate(new Date(), safeProfile.timezone);
  return { supabase, user, profile: safeProfile, today };
});

/** Para Server Actions: no redirige, devuelve null si no hay sesión. */
export async function getActionContext() {
  if (!supabaseEnv()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}
