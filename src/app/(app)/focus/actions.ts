"use server";

import { z } from "zod";
import { ActionError, check, exec, idSchema, runAction } from "@/lib/actions";
import { interruptionInput, manualSessionInput, startSessionInput } from "@/lib/validation/schemas";
import type { FocusSession } from "@/lib/types";

/** Inicia una sesión. El servidor fija la hora de inicio; el cliente solo elige tipo, tarea y duración. */
export async function startSession(input: z.input<typeof startSessionInput>) {
  return runAction(async ({ supabase }) => {
    const data = startSessionInput.parse(input);
    const row = check(
      await supabase
        .from("focus_sessions")
        .insert({ kind: data.kind, task_id: data.task_id ?? null, planned_seconds: data.kind === "stopwatch" ? null : data.planned_seconds })
        .select("*")
        .single<FocusSession>(),
    );
    if (data.task_id && data.kind !== "break") {
      exec(await supabase.from("tasks").update({ status: "in_progress" }).eq("id", data.task_id).eq("status", "todo"));
    }
    return row;
  });
}

const transition = z.enum(["paused", "running", "completed", "abandoned"]);

/** Cambia el estado; los tiempos (pausas, duración efectiva) los calcula la base de datos. */
export async function updateSessionStatus(id: string, status: z.infer<typeof transition>) {
  return runAction(async ({ supabase }) => {
    const row = check(
      await supabase
        .from("focus_sessions")
        .update({ status: transition.parse(status) })
        .eq("id", idSchema.parse(id))
        .select("*")
        .single<FocusSession>(),
    );
    return row;
  });
}

/** "Just Start" → continuar: convierte la sesión corta en cronómetro libre sin perder el tiempo. */
export async function extendSession(id: string, plannedSeconds: number | null) {
  return runAction(async ({ supabase }) => {
    const planned = z.number().int().min(60).max(14400).nullable().parse(plannedSeconds);
    const row = check(
      await supabase
        .from("focus_sessions")
        .update({ planned_seconds: planned })
        .eq("id", idSchema.parse(id))
        .in("status", ["running", "paused"])
        .select("*")
        .single<FocusSession>(),
    );
    return row;
  });
}

export async function setSessionTask(id: string, taskId: string | null) {
  return runAction(async ({ supabase }) => {
    exec(
      await supabase
        .from("focus_sessions")
        .update({ task_id: taskId ? idSchema.parse(taskId) : null })
        .eq("id", idSchema.parse(id)),
    );
  });
}

export async function setSessionNote(id: string, note: string) {
  return runAction(async ({ supabase }) => {
    const n = z.string().trim().max(1000).parse(note);
    exec(await supabase.from("focus_sessions").update({ note: n || null }).eq("id", idSchema.parse(id)));
  });
}

export async function logInterruption(input: z.input<typeof interruptionInput>) {
  return runAction(
    async ({ supabase }) => {
      const data = interruptionInput.parse(input);
      exec(await supabase.from("session_interruptions").insert(data));
      const { count } = await supabase
        .from("session_interruptions")
        .select("id", { count: "exact", head: true })
        .eq("session_id", data.session_id);
      return count ?? 0;
    },
    { revalidate: false },
  );
}

/** Registro manual de tiempo dedicado (cuando se trabajó sin temporizador). */
export async function logManualTime(input: z.input<typeof manualSessionInput>) {
  return runAction(async ({ supabase }) => {
    const data = manualSessionInput.parse(input);
    const end = data.ended_at ? new Date(data.ended_at) : new Date();
    if (end.getTime() > Date.now() + 60_000) throw new ActionError("No puedes registrar tiempo en el futuro.");
    const start = new Date(end.getTime() - data.minutes * 60_000);
    exec(
      await supabase.from("focus_sessions").insert({
        kind: "manual",
        task_id: data.task_id ?? null,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        note: data.note,
      }),
    );
  });
}

export async function deleteSession(id: string) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("focus_sessions").delete().eq("id", idSchema.parse(id)).in("status", ["completed", "abandoned"]));
  });
}
