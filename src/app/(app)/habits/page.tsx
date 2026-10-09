import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { addDays } from "@/lib/domain/dates";
import type { Category, Habit, HabitLog } from "@/lib/types";
import { HabitsView } from "@/components/habits/habits-view";

export const metadata: Metadata = { title: "Hábitos" };

export default async function HabitsPage() {
  const { supabase, today, profile } = await requireUser();
  const [habitsRes, logsRes, catsRes] = await Promise.all([
    supabase.from("habits").select("*").order("archived_at", { nullsFirst: true }).order("position").order("created_at"),
    supabase.from("habit_logs").select("id, habit_id, log_date, status, value").gte("log_date", addDays(today, -400)),
    supabase.from("categories").select("*").is("archived_at", null).order("position"),
  ]);
  return (
    <HabitsView
      habits={(habitsRes.data ?? []) as Habit[]}
      logs={(logsRes.data ?? []) as HabitLog[]}
      categories={(catsRes.data ?? []) as Category[]}
      today={today}
      weekStartsOn={profile.week_starts_on}
      streaksEnabled={profile.streaks_enabled}
    />
  );
}
