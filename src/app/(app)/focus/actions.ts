"use server";

import { z } from "zod";
import { ActionError, check, exec, idSchema, runAction } from "@/lib/actions";
import { interruptionInput, manualSessionInput, sessionReviewInput, startSessionInput } from "@/lib/validation/schemas";
import { isDisciplineReady } from "@/lib/data/discipline";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { FocusSession } from "@/lib/types";

const SETUP_MISSING = "Falta activar el sistema de disciplina en la base de datos. Sigue el aviso del Inicio.";

/** Campos del sistema de disciplina: solo se envían si la migración ya está aplicada. */
async function disciplineFields(supabase: ServerSupabase, fields: Record<string, unknown>) {
  return (await isDisciplineReady(supabase)) ? fields : {};
}

/** Inicio de la actividad más temprana que se solapa con [start, end), o null si el tramo está libre. */
async function firstOverlap(supabase: ServerSupabase, start: Date, end: Date): Promise<Date | null> {
  const { data, error } = await supabase
    .from("focus_sessions")
    .select("started_at")
    .neq("kind", "break")
    .in("status", ["completed", "running", "paused"])
    .lt("started_at", end.toISOString())
    .or(`ended_at.gt.${start.toISOString()},ended_at.is.null`)
    .order("started_at")
    .limit(1);
  if (error) throw new ActionError("No se pudo comprobar el horario. Inténtalo de nuevo.");
  return data && data.length > 0 ? new Date(data[0].started_at as string) : null;
}

const OVERLAP = "Ese horario se solapa con otra actividad registrada. Las horas no se pueden contar dos veces.";

/** Inicia una sesión. El servidor fija la hora de inicio; el cliente solo elige tipo, tarea y duración. */
export async function startSession(input: z.input<typeof startSessionInput>) {
  return runAction(async ({ supabase }) => {
    const data = startSessionInput.parse(input);
    const row = check(
      await supabase
        .from("focus_sessions")
        .insert({
          kind: data.kind,
          task_id: data.task_id ?? null,
          planned_seconds: data.kind === "stopwatch" ? null : data.planned_seconds,
          ...(await disciplineFields(supabase, data.kind === "break" ? {} : { title: data.title, category_id: data.category_id ?? null })),
        })
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

export async function setSessionCategory(id: string, categoryId: string | null) {
  return runAction(async ({ supabase }) => {
    if (!(await isDisciplineReady(supabase))) throw new ActionError(SETUP_MISSING);
    exec(
      await supabase
        .from("focus_sessions")
        .update({ category_id: categoryId ? idSchema.parse(categoryId) : null })
        .eq("id", idSchema.parse(id)),
    );
  });
}

/** Evaluación opcional al terminar: calidad (solo ocupado / productiva / profunda), notas y resultados. */
export async function reviewSession(id: string, input: z.input<typeof sessionReviewInput>) {
  return runAction(async ({ supabase }) => {
    const data = sessionReviewInput.parse(input);
    if (!(await isDisciplineReady(supabase))) throw new ActionError(SETUP_MISSING);
    const patch: Record<string, unknown> = {};
    if (data.quality !== undefined) patch.quality = data.quality;
    if (input.outcome !== undefined) patch.outcome = data.outcome;
    if (input.note !== undefined) patch.note = data.note;
    exec(await supabase.from("focus_sessions").update(patch).eq("id", idSchema.parse(id)).neq("kind", "break"));
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
    let end = data.ended_at ? new Date(data.ended_at) : new Date();
    if (end.getTime() > Date.now() + 60_000) throw new ActionError("No puedes registrar tiempo en el futuro.");
    let start = data.started_at && !data.minutes ? new Date(data.started_at) : new Date(end.getTime() - (data.minutes ?? 0) * 60_000);
    const minutes = (end.getTime() - start.getTime()) / 60_000;
    if (minutes < 1) throw new ActionError("La hora final debe ser posterior a la de inicio.");
    if (minutes > 720) throw new ActionError("Una actividad puede durar como máximo 12 horas. Divídela en varias.");
    if (data.minutes && !data.started_at) {
      // Modo rápido ("trabajé 45 min"): el bloque se coloca justo antes de las actividades que ya cubren ese tramo.
      for (let i = 0; i < 10; i++) {
        const clash = await firstOverlap(supabase, start, end);
        if (!clash) break;
        end = clash;
        start = new Date(end.getTime() - minutes * 60_000);
        if (i === 9) throw new ActionError(OVERLAP);
      }
    } else if (await firstOverlap(supabase, start, end)) {
      throw new ActionError(OVERLAP);
    }
    exec(
      await supabase.from("focus_sessions").insert({
        kind: "manual",
        task_id: data.task_id ?? null,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        note: data.note,
        ...(await disciplineFields(supabase, {
          title: data.title,
          category_id: data.category_id ?? null,
          quality: data.quality ?? null,
          outcome: data.outcome,
        })),
      }),
    );
  });
}

export async function deleteSession(id: string) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("focus_sessions").delete().eq("id", idSchema.parse(id)).in("status", ["completed", "abandoned"]));
  });
}
