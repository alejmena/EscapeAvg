import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { addDays } from "@/lib/domain/dates";
import type { Category, Project, Task } from "@/lib/types";
import { TasksView, type TaskView } from "@/components/tasks/tasks-view";

export const metadata: Metadata = { title: "Tareas" };

const VIEWS: TaskView[] = ["today", "upcoming", "all", "done"];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; category?: string; project?: string }>;
}) {
  const sp = await searchParams;
  const view: TaskView = VIEWS.includes(sp.view as TaskView) ? (sp.view as TaskView) : "today";
  const { supabase, today, profile } = await requireUser();

  let query = supabase.from("tasks").select("*").neq("status", "archived");
  if (view === "done") {
    query = query.eq("status", "done").order("completed_at", { ascending: false }).limit(150);
  } else {
    // Tareas abiertas + las completadas recientemente (para ver lo hecho hoy).
    query = query.or(`status.neq.done,completed_at.gte.${addDays(today, -1)}`).order("position").order("created_at");
  }
  const [tasksRes, catsRes, projRes] = await Promise.all([
    query,
    supabase.from("categories").select("*").is("archived_at", null).order("position"),
    supabase.from("projects").select("*").neq("status", "archived").order("created_at"),
  ]);

  let tasks = (tasksRes.data ?? []) as Task[];
  // Las subtareas siempre se cargan con su padre.
  if (view === "done") {
    const ids = tasks.filter((t) => !t.parent_id).map((t) => t.id);
    if (ids.length) {
      const { data: subs } = await supabase.from("tasks").select("*").in("parent_id", ids);
      tasks = [...tasks.filter((t) => !t.parent_id), ...((subs ?? []) as Task[])];
    }
  }

  return (
    <TasksView
      view={view}
      today={today}
      timezone={profile.timezone}
      tasks={tasks}
      categories={(catsRes.data ?? []) as Category[]}
      projects={(projRes.data ?? []) as Project[]}
      filterCategory={sp.category ?? null}
      filterProject={sp.project ?? null}
    />
  );
}
