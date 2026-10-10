"use server";

import { z } from "zod";
import { ActionError, check, exec, idSchema, runAction } from "@/lib/actions";
import { findOverlap, formatTime, parseTime } from "@/lib/domain/schedule";
import { hexColor } from "@/lib/validation/schemas";
import { IDEA_BY_KEY } from "@/lib/ideas/catalog";
import { WEEKDAY_NAME } from "@/lib/format";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { ScheduleBlock } from "@/lib/types";

const time = z.string().refine((s) => parseTime(s) !== null, "Hora inválida");
const slot = z
  .object({ day: z.number().int().min(0).max(6), start: time, end: time })
  .transform((s) => ({ day_of_week: s.day, start_minute: parseTime(s.start)!, end_minute: parseTime(s.end)! }))
  .refine((s) => s.end_minute > s.start_minute, "La hora de fin debe ser posterior a la de inicio");

const blockInput = z
  .object({
    title: z.string().trim().min(1, "Ponle un nombre").max(80, "Máximo 80 caracteres"),
    color: hexColor,
    idea_key: z
      .string()
      .max(80)
      .refine((k) => IDEA_BY_KEY.has(k), "Idea desconocida")
      .nullable()
      .optional(),
    note: z.string().trim().max(300).nullable().optional(),
    slots: z.array(slot).min(1, "Elige al menos un día").max(21),
  })
  .strict();

export type SlotInput = { day: number; start: string; end: string };
export type BlockInput = { title: string; color: string; idea_key?: string | null; note?: string | null; slots: SlotInput[] };

type Span = Pick<ScheduleBlock, "day_of_week" | "start_minute" | "end_minute">;

async function assertNoOverlap(supabase: ServerSupabase, spans: Span[], ignoreId?: string) {
  const existing = check(await supabase.from("schedule_blocks").select("id, title, day_of_week, start_minute, end_minute")) as (Span & { id: string; title: string })[];
  const placed: (Span & { id?: string; title: string })[] = [...existing];
  for (const s of spans) {
    const hit = findOverlap(placed, s, ignoreId);
    if (hit) {
      throw new ActionError(
        `Se solapa con «${hit.title}» el ${WEEKDAY_NAME[s.day_of_week].toLowerCase()} de ${formatTime(hit.start_minute)} a ${formatTime(hit.end_minute)}.`,
      );
    }
    placed.push({ ...s, title: "otro bloque nuevo" });
  }
}

/** Crea uno o varios bloques (un día puede tener su propia hora). */
export async function addScheduleBlocks(input: BlockInput) {
  return runAction(async ({ supabase }) => {
    const data = blockInput.parse(input);
    await assertNoOverlap(supabase, data.slots);
    exec(
      await supabase.from("schedule_blocks").insert(
        data.slots.map((s) => ({ ...s, title: data.title, color: data.color, idea_key: data.idea_key ?? null, note: data.note || null })),
      ),
    );
    return data.slots.length;
  });
}

export async function updateScheduleBlock(id: string, input: { title: string; color: string; note?: string | null; slot: SlotInput }) {
  return runAction(async ({ supabase }) => {
    const blockId = idSchema.parse(id);
    const data = z
      .object({ title: z.string().trim().min(1, "Ponle un nombre").max(80), color: hexColor, note: z.string().trim().max(300).nullable().optional(), slot })
      .strict()
      .parse(input);
    await assertNoOverlap(supabase, [data.slot], blockId);
    exec(await supabase.from("schedule_blocks").update({ ...data.slot, title: data.title, color: data.color, note: data.note || null }).eq("id", blockId));
  });
}

export async function deleteScheduleBlock(id: string) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("schedule_blocks").delete().eq("id", idSchema.parse(id)));
  });
}
