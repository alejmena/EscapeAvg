"use server";

import { z } from "zod";
import { check, exec, idSchema, runAction } from "@/lib/actions";
import { localDate } from "@/lib/domain/dates";
import { nextOccurrence, type RecurrenceRule } from "@/lib/domain/recurrence";
import { projectInput, taskInput, taskUpdate, type TaskInput, type TaskUpdate } from "@/lib/validation/schemas";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Task } from "@/lib/types";

export async function createTask(input: TaskInput) {
  return runAction(async ({ supabase }) => {
    const data = taskInput.parse(input);
    const row = check(await supabase.from("tasks").insert(data).select("id").single());
    return row.id as string;
  });
}

export async function updateTask(id: string, patch: TaskUpdate) {
  return runAction(async ({ supabase }) => {
    const taskId = idSchema.parse(id);
    const data = taskUpdate.parse(patch);
    const { status, ...rest } = data;
    if (Object.keys(rest).length) exec(await supabase.from("tasks").update(rest).eq("id", taskId));
    if (status) await applyStatus(supabase, taskId, status);
  });
}

export async function setTaskStatus(id: string, status: Task["status"]) {
  return runAction(async ({ supabase }) => {
    await applyStatus(supabase, idSchema.parse(id), z.enum(["todo", "in_progress", "done", "archived"]).parse(status));
  });
}

async function applyStatus(supabase: ServerSupabase, id: string, status: Task["status"]) {
  const task = check(await supabase.from("tasks").select("*").eq("id", id).single<Task>());
  exec(await supabase.from("tasks").update({ status }).eq("id", id));
  if (status === "done" && task.status !== "done" && task.recurrence) {
    await spawnNextOccurrence(supabase, task);
  }
}

/** Al completar una tarea recurrente se crea la siguiente (con sus subtareas reiniciadas). Idempotente. */
async function spawnNextOccurrence(supabase: ServerSupabase, task: Task) {
  const { data: profile } = await supabase.from("profiles").select("timezone").single<{ timezone: string }>();
  const today = localDate(new Date(), profile?.timezone ?? "UTC");
  const base = task.due_date && task.due_date >= today ? task.due_date : today;
  let next = nextOccurrence(task.recurrence as RecurrenceRule, task.due_date ?? today);
  if (next <= today) next = nextOccurrence(task.recurrence as RecurrenceRule, base);
  const seriesId = task.recurrence_source_id ?? task.id;

  const existing = check(
    await supabase.from("tasks").select("id").eq("recurrence_source_id", seriesId).eq("due_date", next).limit(1),
  );
  if (existing.length) return;

  const created = check(
    await supabase
      .from("tasks")
      .insert({
        title: task.title,
        notes: task.notes,
        priority: task.priority,
        due_date: next,
        category_id: task.category_id,
        project_id: task.project_id,
        parent_id: task.parent_id,
        estimated_minutes: task.estimated_minutes,
        progress_target: task.progress_target,
        progress_unit: task.progress_unit,
        recurrence: task.recurrence,
        recurrence_source_id: seriesId,
        position: task.position,
      })
      .select("id")
      .single(),
  );
  const subtasks = check(await supabase.from("tasks").select("title, position, estimated_minutes").eq("parent_id", task.id));
  if (subtasks.length) {
    exec(
      await supabase.from("tasks").insert(
        subtasks.map((s) => ({ ...s, parent_id: created.id, category_id: task.category_id, project_id: task.project_id })),
      ),
    );
  }
}

export async function deleteTask(id: string) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("tasks").delete().eq("id", idSchema.parse(id)));
  });
}

/** Suma (o resta) al contador de progreso, sin pasar de los límites. */
export async function bumpProgress(id: string, delta: number) {
  return runAction(async ({ supabase }) => {
    const taskId = idSchema.parse(id);
    const d = z.number().int().min(-1000).max(1000).parse(delta);
    const task = check(await supabase.from("tasks").select("progress_current, progress_target").eq("id", taskId).single());
    const target = task.progress_target as number | null;
    let value = Math.max(0, (task.progress_current as number) + d);
    if (target) value = Math.min(target, value);
    exec(await supabase.from("tasks").update({ progress_current: value }).eq("id", taskId));
    return value;
  });
}

/** Crea varias subtareas de golpe (p. ej. desde "dividir en pasos"). */
export async function addSubtasks(parentId: string, titles: string[]) {
  return runAction(async ({ supabase }) => {
    const pid = idSchema.parse(parentId);
    const list = z.array(z.string().trim().min(1).max(200)).min(1).max(30).parse(titles);
    const parent = check(await supabase.from("tasks").select("category_id, project_id").eq("id", pid).single());
    exec(
      await supabase.from("tasks").insert(
        list.map((title, i) => ({ title, parent_id: pid, position: i, category_id: parent.category_id, project_id: parent.project_id })),
      ),
    );
  });
}

export async function createProject(input: z.input<typeof projectInput>) {
  return runAction(async ({ supabase }) => {
    const row = check(await supabase.from("projects").insert(projectInput.parse(input)).select("id").single());
    return row.id as string;
  });
}

export async function updateProject(id: string, input: Partial<z.input<typeof projectInput>> & { status?: string }) {
  return runAction(async ({ supabase }) => {
    const patch = projectInput
      .partial()
      .extend({ status: z.enum(["active", "paused", "done", "archived"]).optional() })
      .parse(input);
    exec(await supabase.from("projects").update(patch).eq("id", idSchema.parse(id)));
  });
}

export async function deleteProject(id: string) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("projects").delete().eq("id", idSchema.parse(id)));
  });
}
