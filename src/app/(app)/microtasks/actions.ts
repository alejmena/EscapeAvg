"use server";

import { z } from "zod";
import { check, exec, idSchema, runAction } from "@/lib/actions";
import { localDate } from "@/lib/domain/dates";
import type { ServerSupabase } from "@/lib/supabase/server";
import { QUICK_FIELDS } from "@/lib/data/quick";
import type { QuickTask, QuickTemplate } from "@/lib/types";

const title = z.string().trim().min(1, "Escribe algo").max(200, "Máximo 200 caracteres");
const days = z.array(z.number().int().min(0).max(6)).max(7).transform((d) => [...new Set(d)].sort());
const position = z.number().finite();

async function today(supabase: ServerSupabase) {
  const { data } = await supabase.from("profiles").select("timezone").single<{ timezone: string }>();
  return localDate(new Date(), data?.timezone ?? "UTC");
}

/** Crea una microtarea para hoy. Solo pide el texto. */
export async function addQuickTask(input: { title: string; position: number }) {
  return runAction(async ({ supabase }) => {
    const data = z.object({ title, position }).strict().parse(input);
    const row = check(
      await supabase
        .from("tasks")
        .insert({ title: data.title, position: data.position, quick: true, due_date: await today(supabase) })
        .select(QUICK_FIELDS)
        .single(),
    );
    return row as QuickTask;
  });
}

/** Marca o desmarca. Cuenta como tarea completada; no añade tiempo productivo. */
export async function toggleQuickTask(id: string, done: boolean) {
  return runAction(async ({ supabase }) => {
    exec(
      await supabase
        .from("tasks")
        .update({ status: z.boolean().parse(done) ? "done" : "todo" })
        .eq("id", idSchema.parse(id))
        .eq("quick", true),
    );
  });
}

export async function renameQuickTask(id: string, newTitle: string) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("tasks").update({ title: title.parse(newTitle) }).eq("id", idSchema.parse(id)).eq("quick", true));
  });
}

export async function deleteQuickTask(id: string) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("tasks").delete().eq("id", idSchema.parse(id)).eq("quick", true));
  });
}

/** Deshacer un borrado: vuelve a crear la microtarea con el mismo texto, estado, día y posición. */
export async function restoreQuickTask(input: { title: string; done: boolean; due_date: string | null; position: number }) {
  return runAction(async ({ supabase }) => {
    const data = z
      .object({ title, done: z.boolean(), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), position })
      .strict()
      .parse(input);
    const row = check(
      await supabase
        .from("tasks")
        .insert({ title: data.title, status: data.done ? "done" : "todo", due_date: data.due_date, position: data.position, quick: true })
        .select(QUICK_FIELDS)
        .single(),
    );
    return row as QuickTask;
  });
}

/** Guarda el nuevo orden tras arrastrar. */
export async function reorderQuickTasks(ids: string[]) {
  return runAction(async ({ supabase }) => {
    const list = z.array(idSchema).max(300).parse(ids);
    const results = await Promise.all(list.map((id, i) => supabase.from("tasks").update({ position: i + 1 }).eq("id", id).eq("quick", true)));
    results.forEach(exec);
  }, { revalidate: false });
}

/** Reinicio diario: conservar las pendientes al día siguiente (true) o archivarlas (false). */
export async function setQuickCarryOver(carryOver: boolean) {
  return runAction(async ({ supabase, userId }) => {
    exec(await supabase.from("profiles").update({ quick_tasks_carry_over: z.boolean().parse(carryOver) }).eq("id", userId));
  });
}

// ---------------------------------------------------------------------------
// Plantillas y recurrentes
// ---------------------------------------------------------------------------

export async function createQuickTemplate(input: { title: string; repeat_days: number[] }) {
  return runAction(async ({ supabase }) => {
    const data = z.object({ title, repeat_days: days }).strict().parse(input);
    const row = check(await supabase.from("quick_task_templates").insert(data).select("id, title, repeat_days, position").single());
    return row as QuickTemplate;
  });
}

export async function updateQuickTemplate(id: string, input: { title?: string; repeat_days?: number[] }) {
  return runAction(async ({ supabase }) => {
    const data = z.object({ title: title.optional(), repeat_days: days.optional() }).strict().parse(input);
    exec(await supabase.from("quick_task_templates").update(data).eq("id", idSchema.parse(id)));
  });
}

export async function deleteQuickTemplate(id: string) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("quick_task_templates").delete().eq("id", idSchema.parse(id)));
  });
}

/**
 * Convierte una microtarea en recurrente (días elegidos) o la guarda como plantilla (sin días).
 * La de hoy queda enlazada para que no se duplique.
 */
export async function makeQuickRecurring(taskId: string, repeatDays: number[]) {
  return runAction(async ({ supabase }) => {
    const id = idSchema.parse(taskId);
    const repeat = days.parse(repeatDays);
    const task = check(await supabase.from("tasks").select("title, due_date, quick_template_id").eq("id", id).eq("quick", true).single());
    const day = await today(supabase);
    if (task.quick_template_id) {
      exec(await supabase.from("quick_task_templates").update({ repeat_days: repeat }).eq("id", task.quick_template_id));
      return;
    }
    const tpl = check(
      await supabase
        .from("quick_task_templates")
        .insert({ title: task.title, repeat_days: repeat, last_spawned_on: day })
        .select("id")
        .single(),
    );
    if (repeat.length) exec(await supabase.from("tasks").update({ quick_template_id: tpl.id, due_date: day }).eq("id", id));
  });
}
