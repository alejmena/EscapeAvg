import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActionContext } from "@/lib/auth";
import type { ServerSupabase } from "@/lib/supabase/server";
import { firstError } from "@/lib/validation/schemas";
import type { ActionResult } from "@/lib/types";

type Ctx = { supabase: ServerSupabase; userId: string };

/** Traduce errores de Postgres/PostgREST a mensajes comprensibles sin filtrar detalles internos. */
export function friendlyDbError(error: { code?: string; message?: string } | null): string {
  if (!error) return "Error desconocido";
  switch (error.code) {
    case "23505":
      return error.message?.includes("focus_sessions_one_active")
        ? "Ya tienes una sesión activa. Termínala antes de empezar otra."
        : "Ya existe un elemento igual.";
    case "23503":
      return "El elemento relacionado no existe o no es tuyo.";
    case "23514":
    case "22023":
    case "22P02":
      return "Algún dato no es válido.";
    case "42501":
      return "No tienes permiso para hacer esto.";
    case "PGRST116":
      return "No encontrado.";
    default:
      return "No se pudo guardar. Inténtalo de nuevo.";
  }
}

export class ActionError extends Error {}

/**
 * Envuelve una Server Action: exige sesión, captura errores y revalida la UI.
 * La validación de entrada se hace con `parse` (zod) dentro de `fn`.
 */
export async function runAction<T>(fn: (ctx: Ctx) => Promise<T>, opts: { revalidate?: boolean } = {}): Promise<ActionResult<T>> {
  const ctx = await getActionContext();
  if (!ctx) return { ok: false, error: "Tu sesión ha caducado. Vuelve a entrar." };
  try {
    const data = await fn({ supabase: ctx.supabase, userId: ctx.user.id });
    if (opts.revalidate !== false) revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof z.ZodError) return { ok: false, error: firstError(e) };
    if (e instanceof ActionError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Algo salió mal. Inténtalo de nuevo." };
  }
}

/** Devuelve los datos de una consulta; lanza ActionError con mensaje amigable si hay error o no hay filas. */
export function check<T>(res: { data: T; error: { code?: string; message?: string } | null }): NonNullable<T> {
  if (res.error) {
    console.error("db error", res.error);
    throw new ActionError(friendlyDbError(res.error));
  }
  if (res.data == null) throw new ActionError("No encontrado.");
  return res.data as NonNullable<T>;
}

/** Para mutaciones sin datos de retorno. */
export function exec(res: { error: { code?: string; message?: string } | null }): void {
  if (res.error) {
    console.error("db error", res.error);
    throw new ActionError(friendlyDbError(res.error));
  }
}

export const idSchema = z.string().uuid();
