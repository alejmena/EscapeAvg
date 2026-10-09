import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { addDays } from "@/lib/domain/dates";
import { normalizePomodoro } from "@/lib/domain/timer";
import type { FocusSession, Task } from "@/lib/types";
import { FocusClient, type HistoryItem } from "@/components/focus/focus-client";

export const metadata: Metadata = { title: "Concentración" };

export default async function FocusPage({ searchParams }: { searchParams: Promise<{ task?: string; just?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile, today } = await requireUser();

  const [activeRes, tasksRes, historyRes] = await Promise.all([
    supabase.from("focus_sessions").select("*").in("status", ["running", "paused"]).maybeSingle<FocusSession>(),
    supabase
      .from("tasks")
      .select("id, title, parent_id, category_id, estimated_minutes, actual_seconds, due_date, priority, status")
      .in("status", ["todo", "in_progress"])
      .order("priority", { ascending: false })
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(200),
    supabase
      .from("focus_sessions")
      .select("id, kind, status, started_at, ended_at, focus_seconds, planned_seconds, note, task_id, tasks(title), session_interruptions(count)")
      .in("status", ["completed", "abandoned"])
      .gte("started_at", `${addDays(today, -7)}T00:00:00Z`)
      .order("started_at", { ascending: false })
      .limit(60),
  ]);

  type Raw = Omit<HistoryItem, "task_title" | "interruptions"> & {
    tasks: { title: string } | { title: string }[] | null;
    session_interruptions: { count: number }[];
  };
  const history: HistoryItem[] = ((historyRes.data ?? []) as unknown as Raw[]).map(({ tasks, session_interruptions, ...s }) => ({
    ...s,
    task_title: Array.isArray(tasks) ? (tasks[0]?.title ?? null) : (tasks?.title ?? null),
    interruptions: session_interruptions?.[0]?.count ?? 0,
  }));

  const just = sp.just === "2" || sp.just === "5" ? Number(sp.just) : null;
  const tasks = (tasksRes.data ?? []) as Pick<Task, "id" | "title" | "parent_id" | "estimated_minutes" | "actual_seconds">[];
  const initialTask = sp.task && tasks.some((t) => t.id === sp.task) ? sp.task : null;

  return (
    <FocusClient
      active={activeRes.data ?? null}
      tasks={tasks}
      history={history}
      settings={normalizePomodoro(profile.pomodoro_settings)}
      timezone={profile.timezone}
      today={today}
      initialTaskId={initialTask}
      initialJust={just}
    />
  );
}
