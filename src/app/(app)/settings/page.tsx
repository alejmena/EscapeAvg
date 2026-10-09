import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { normalizePomodoro } from "@/lib/domain/timer";
import type { Category } from "@/lib/types";
import { SettingsView } from "@/components/settings/settings-view";
import { dailyGoal, isDisciplineReady } from "@/lib/data/discipline";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const { supabase, profile, user } = await requireUser();
  const [{ data }, ready] = await Promise.all([supabase.from("categories").select("*").order("position"), isDisciplineReady(supabase)]);
  return (
    <SettingsView
      email={user.email ?? ""}
      profile={{
        display_name: profile.display_name ?? "",
        timezone: profile.timezone,
        week_starts_on: profile.week_starts_on,
        weekly_focus_goal_minutes: profile.weekly_focus_goal_minutes,
        streaks_enabled: profile.streaks_enabled,
        pomodoro_settings: normalizePomodoro(profile.pomodoro_settings),
      }}
      categories={(data ?? []) as Category[]}
      goalMinutes={dailyGoal(profile)}
      ready={ready}
    />
  );
}
