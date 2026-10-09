"use server";

import { z } from "zod";
import { check, exec, idSchema, runAction } from "@/lib/actions";
import { goalInput } from "@/lib/validation/schemas";

export async function createGoal(input: z.input<typeof goalInput>) {
  return runAction(async ({ supabase }) => {
    const data = goalInput.parse(input);
    const row = check(
      await supabase
        .from("goals")
        .insert({ ...data, start_date: data.period === "custom" ? data.start_date : null, end_date: data.period === "custom" ? data.end_date : null })
        .select("id")
        .single(),
    );
    return row.id as string;
  });
}

export async function setGoalStatus(id: string, status: "active" | "achieved" | "archived") {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("goals").update({ status: z.enum(["active", "achieved", "archived"]).parse(status) }).eq("id", idSchema.parse(id)));
  });
}

export async function setGoalManualValue(id: string, value: number) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("goals").update({ manual_value: z.number().min(0).max(1000000).parse(value) }).eq("id", idSchema.parse(id)));
  });
}

export async function deleteGoal(id: string) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("goals").delete().eq("id", idSchema.parse(id)));
  });
}
