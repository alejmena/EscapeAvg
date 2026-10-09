"use server";

import { ActionError, check, exec, idSchema, runAction } from "@/lib/actions";
import { localDate } from "@/lib/domain/dates";
import { habitInput, habitLogInput, type HabitInput } from "@/lib/validation/schemas";
import { z } from "zod";

function normalize(data: z.output<typeof habitInput>) {
  return {
    ...data,
    times_per_week: data.frequency === "weekly" ? data.times_per_week : null,
    days_of_week: data.frequency === "specific_days" ? [...new Set(data.days_of_week ?? [])].sort() : null,
  };
}

export async function createHabit(input: HabitInput) {
  return runAction(async ({ supabase }) => {
    const row = check(await supabase.from("habits").insert(normalize(habitInput.parse(input))).select("id").single());
    return row.id as string;
  });
}

export async function updateHabit(id: string, input: HabitInput) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("habits").update(normalize(habitInput.parse(input))).eq("id", idSchema.parse(id)));
  });
}

export async function archiveHabit(id: string, archived: boolean) {
  return runAction(async ({ supabase }) => {
    exec(
      await supabase
        .from("habits")
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq("id", idSchema.parse(id)),
    );
  });
}

export async function deleteHabit(id: string) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("habits").delete().eq("id", idSchema.parse(id)));
  });
}

/** Marca un día como hecho / descanso / no hecho, o borra el registro (status null). */
export async function setHabitLog(input: z.input<typeof habitLogInput>) {
  return runAction(async ({ supabase }) => {
    const data = habitLogInput.parse(input);
    const { data: profile } = await supabase.from("profiles").select("timezone").single<{ timezone: string }>();
    const today = localDate(new Date(), profile?.timezone ?? "UTC");
    if (data.log_date > today) throw new ActionError("No puedes registrar días futuros.");
    if (data.status === null) {
      exec(await supabase.from("habit_logs").delete().eq("habit_id", data.habit_id).eq("log_date", data.log_date));
      return;
    }
    exec(
      await supabase
        .from("habit_logs")
        .upsert(
          { habit_id: data.habit_id, log_date: data.log_date, status: data.status, value: data.value ?? null },
          { onConflict: "habit_id,log_date" },
        ),
    );
  });
}

export async function addRestDay(day: string, reason?: string) {
  return runAction(async ({ supabase }) => {
    const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(day);
    exec(await supabase.from("rest_days").upsert({ day: d, reason: reason?.slice(0, 140) ?? null }, { onConflict: "user_id,day" }));
  });
}

export async function removeRestDay(day: string) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("rest_days").delete().eq("day", z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(day)));
  });
}
