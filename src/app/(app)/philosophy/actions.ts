"use server";

import { ActionError, exec, runAction } from "@/lib/actions";
import { isDisciplineReady } from "@/lib/data/discipline";
import { quoteById } from "@/lib/domain/quotes";
import { quoteIdInput } from "@/lib/validation/schemas";

/** Marca o desmarca una frase como favorita. Devuelve el nuevo estado. */
export async function toggleFavoriteQuote(id: string, favorite: boolean) {
  return runAction(async ({ supabase }) => {
    const quoteId = quoteIdInput.parse(id);
    if (!quoteById(quoteId)) throw new ActionError("Esa frase no existe.");
    if (!(await isDisciplineReady(supabase))) {
      throw new ActionError("Falta activar el sistema de disciplina en la base de datos. Sigue el aviso del Inicio.");
    }
    if (favorite) {
      const { error } = await supabase.from("favorite_quotes").insert({ quote_id: quoteId });
      if (error && error.code !== "23505") exec({ error });
    } else {
      exec(await supabase.from("favorite_quotes").delete().eq("quote_id", quoteId));
    }
    return favorite;
  });
}
