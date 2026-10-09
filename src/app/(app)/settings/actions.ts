"use server";

import { z } from "zod";
import { exec, idSchema, runAction } from "@/lib/actions";
import { categoryInput, profileInput } from "@/lib/validation/schemas";

export async function updateProfile(input: z.input<typeof profileInput>) {
  return runAction(async ({ supabase, userId }) => {
    exec(await supabase.from("profiles").update(profileInput.parse(input)).eq("id", userId));
  });
}

export async function createCategory(input: z.input<typeof categoryInput>) {
  return runAction(async ({ supabase }) => {
    const data = categoryInput.parse(input);
    const { count } = await supabase.from("categories").select("id", { count: "exact", head: true });
    exec(await supabase.from("categories").insert({ ...data, position: count ?? 0 }));
  });
}

export async function updateCategory(id: string, input: z.input<typeof categoryInput>) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("categories").update(categoryInput.parse(input)).eq("id", idSchema.parse(id)));
  });
}

/** Las tareas y hábitos de la categoría se conservan (quedan sin categoría). */
export async function deleteCategory(id: string) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("categories").delete().eq("id", idSchema.parse(id)));
  });
}
