"use server";

import { z } from "zod";
import { check, exec, idSchema, runAction } from "@/lib/actions";
import { hexColor, notePatch } from "@/lib/validation/schemas";
import type { Note } from "@/lib/types";

const boardName = z.string().trim().min(1).max(60);

export async function createBoard(name: string) {
  return runAction(async ({ supabase }) => {
    const row = check(await supabase.from("boards").insert({ name: boardName.parse(name) }).select("id").single());
    return row.id as string;
  });
}

export async function updateBoard(id: string, patch: { name?: string; color?: string }) {
  return runAction(async ({ supabase }) => {
    const data = z.object({ name: boardName.optional(), color: hexColor.optional() }).strict().parse(patch);
    exec(await supabase.from("boards").update(data).eq("id", idSchema.parse(id)));
  });
}

export async function deleteBoard(id: string) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("boards").delete().eq("id", idSchema.parse(id)));
  });
}

export async function createNote(boardId: string, patch: z.input<typeof notePatch>) {
  return runAction(
    async ({ supabase }) => {
      const data = notePatch.parse(patch);
      return check(await supabase.from("notes").insert({ board_id: idSchema.parse(boardId), ...data }).select("*").single<Note>());
    },
    { revalidate: false },
  );
}

/** Autoguardado: no revalida la página para no interrumpir la edición. */
export async function updateNote(id: string, patch: z.input<typeof notePatch>) {
  return runAction(
    async ({ supabase }) => {
      exec(await supabase.from("notes").update(notePatch.parse(patch)).eq("id", idSchema.parse(id)));
    },
    { revalidate: false },
  );
}

export async function updateNotePositions(items: { id: string; x: number; y: number }[]) {
  return runAction(
    async ({ supabase }) => {
      const list = z
        .array(z.object({ id: idSchema, x: z.number().int().min(0).max(20000), y: z.number().int().min(0).max(20000) }))
        .max(500)
        .parse(items);
      await Promise.all(list.map((n) => supabase.from("notes").update({ x: n.x, y: n.y }).eq("id", n.id).then(exec)));
    },
    { revalidate: false },
  );
}

export async function deleteNote(id: string) {
  return runAction(
    async ({ supabase }) => {
      exec(await supabase.from("notes").delete().eq("id", idSchema.parse(id)));
    },
    { revalidate: false },
  );
}

/** Convierte una nota en tarea formal: primera línea = título, resto = notas. */
export async function convertNoteToTask(id: string) {
  return runAction(async ({ supabase }) => {
    const note = check(await supabase.from("notes").select("*").eq("id", idSchema.parse(id)).single<Note>());
    if (note.task_id) return note.task_id;
    const lines = note.content
      .split("\n")
      .map((l) => l.replace(/^\s*([-*•]|\[ ?\]|\d+[.)])\s*/, "").trim())
      .filter(Boolean);
    const title = (lines[0] ?? "Nota sin título").slice(0, 200);
    const rest = lines.slice(1);
    const task = check(
      await supabase
        .from("tasks")
        .insert({ title, notes: rest.length > 1 ? null : (rest[0] ?? null) })
        .select("id")
        .single(),
    );
    // Si la nota era una lista, cada línea pasa a ser un paso (subtarea).
    if (rest.length > 1) {
      exec(await supabase.from("tasks").insert(rest.slice(0, 30).map((t, i) => ({ title: t.slice(0, 200), parent_id: task.id, position: i }))));
    }
    exec(await supabase.from("notes").update({ task_id: task.id }).eq("id", note.id));
    return task.id as string;
  });
}
