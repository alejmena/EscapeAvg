"use server";

import { z } from "zod";
import { ActionError, exec, idSchema, runAction } from "@/lib/actions";
import { isDisciplineReady } from "@/lib/data/discipline";
import { categoryInput, dailyGoalInput, profileInput } from "@/lib/validation/schemas";

const SETUP_MISSING = "Falta activar el sistema de disciplina en la base de datos. Sigue el aviso del Inicio.";

/** Objetivo diario de horas productivas. Al cumplirlo, la app lo reconoce como un día completo. */
export async function updateDailyGoal(minutes: number) {
  return runAction(async ({ supabase, userId }) => {
    const value = dailyGoalInput.parse(minutes);
    if (!(await isDisciplineReady(supabase))) throw new ActionError(SETUP_MISSING);
    exec(await supabase.from("profiles").update({ daily_goal_minutes: value }).eq("id", userId));
  });
}

export async function updateProfile(input: z.input<typeof profileInput>) {
  return runAction(async ({ supabase, userId }) => {
    exec(await supabase.from("profiles").update(profileInput.parse(input)).eq("id", userId));
  });
}

export async function createCategory(input: z.input<typeof categoryInput>) {
  return runAction(async ({ supabase }) => {
    const { counts_as_development, ...data } = categoryInput.parse(input);
    if (counts_as_development === false && !(await isDisciplineReady(supabase))) throw new ActionError(SETUP_MISSING);
    const { count } = await supabase.from("categories").select("id", { count: "exact", head: true });
    exec(
      await supabase
        .from("categories")
        .insert({ ...data, ...(counts_as_development === false ? { counts_as_development } : {}), position: count ?? 0 }),
    );
  });
}

export async function updateCategory(id: string, input: z.input<typeof categoryInput>) {
  return runAction(async ({ supabase }) => {
    const data = categoryInput.parse(input);
    if (data.counts_as_development !== undefined && !(await isDisciplineReady(supabase))) throw new ActionError(SETUP_MISSING);
    exec(await supabase.from("categories").update(data).eq("id", idSchema.parse(id)));
  });
}

/** Las tareas y hábitos de la categoría se conservan (quedan sin categoría). */
export async function deleteCategory(id: string) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("categories").delete().eq("id", idSchema.parse(id)));
  });
}
