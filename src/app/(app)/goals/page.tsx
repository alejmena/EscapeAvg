import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getGoalsWithProgress } from "@/lib/data/stats";
import type { Category } from "@/lib/types";
import { GoalsView } from "@/components/goals/goals-view";

export const metadata: Metadata = { title: "Objetivos" };

export default async function GoalsPage() {
  const { supabase, profile, today } = await requireUser();
  const [goals, cats, done] = await Promise.all([
    getGoalsWithProgress(supabase, today, profile.week_starts_on),
    supabase.from("categories").select("*").is("archived_at", null).order("position"),
    supabase
      .from("goals")
      .select("id, title, status, updated_at")
      .or(`status.neq.active,and(period.eq.custom,end_date.lt.${today})`)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);
  return (
    <GoalsView
      goals={goals}
      categories={(cats.data ?? []) as Category[]}
      past={(done.data ?? []) as { id: string; title: string; status: string }[]}
      today={today}
    />
  );
}
