"use server";

import { z } from "zod";
import { ActionError, exec, idSchema, runAction } from "@/lib/actions";
import { groupInput, inviteCodeInput, sharedChallengeInput, socialProfileInput, usernameInput } from "@/lib/validation/schemas";

type DbError = { code?: string; message?: string } | null;

/** Errores propios de la parte social, con mensajes claros. */
function socialError(error: DbError, fallback = "No se pudo guardar. Inténtalo de nuevo."): never {
  console.error("db error", error);
  if (error?.code && ["42P01", "42883", "PGRST202", "PGRST205"].includes(error.code)) {
    throw new ActionError("Las funciones sociales aún se están activando. Inténtalo más tarde.");
  }
  if (error?.code === "23505") throw new ActionError("Ese nombre de usuario ya está en uso. Prueba con otro.");
  if (error?.code === "23514" && error.message?.includes("too many groups")) throw new ActionError("Has llegado al máximo de 20 grupos creados.");
  if (error?.code === "23514" && error.message?.includes("group is full")) throw new ActionError("Este grupo ya tiene el máximo de 50 personas.");
  if (error?.code === "23514" && error.message?.includes("pending")) throw new ActionError("Tienes demasiadas solicitudes pendientes.");
  if (error?.code === "42501") throw new ActionError("No tienes permiso para hacer esto.");
  if (error?.code === "P0002") throw new ActionError("Esa solicitud ya no existe.");
  throw new ActionError(fallback);
}

export async function updateSocialProfile(input: z.input<typeof socialProfileInput>) {
  return runAction(async ({ supabase, userId }) => {
    const data = socialProfileInput.parse(input);
    if (data.share_stats && !data.username) throw new ActionError("Elige un nombre de usuario para poder compartir.");
    const { error } = await supabase.from("profiles").update(data).eq("id", userId);
    if (error) socialError(error);
  });
}

const REQUEST_MESSAGES: Record<string, string> = {
  sent: "Solicitud enviada.",
  accepted: "¡Ahora sois amigos! Esa persona ya te había enviado una solicitud.",
  already_friends: "Ya sois amigos.",
  already_sent: "Ya le enviaste una solicitud. Falta que la acepte.",
};

export async function sendFriendRequest(username: string) {
  return runAction(async ({ supabase }) => {
    const name = usernameInput.parse(username).replace(/^@/, "");
    const { data, error } = await supabase.rpc("send_friend_request", { p_username: name });
    if (error) socialError(error);
    if (data === "not_found") throw new ActionError(`No existe nadie con el usuario @${name}.`);
    if (data === "self") throw new ActionError("Ese es tu propio usuario.");
    return REQUEST_MESSAGES[String(data)] ?? "Hecho.";
  });
}

export async function respondFriendRequest(id: string, accept: boolean) {
  return runAction(async ({ supabase }) => {
    const { error } = await supabase.rpc("respond_friend_request", { p_id: idSchema.parse(id), p_accept: z.boolean().parse(accept) });
    if (error) socialError(error);
  });
}

/** Elimina una amistad o cancela una solicitud enviada. */
export async function removeFriendship(id: string) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("friendships").delete().eq("id", idSchema.parse(id)));
  });
}

export async function createGroup(input: z.input<typeof groupInput>) {
  return runAction(async ({ supabase }) => {
    const data = groupInput.parse(input);
    const { data: id, error } = await supabase.rpc("create_group", { p_name: data.name, p_description: data.description });
    if (error) socialError(error);
    return String(id);
  });
}

export async function updateGroup(id: string, input: z.input<typeof groupInput>) {
  return runAction(async ({ supabase }) => {
    const { error } = await supabase.from("groups").update(groupInput.parse(input)).eq("id", idSchema.parse(id));
    if (error) socialError(error);
  });
}

export async function joinGroup(code: string) {
  return runAction(async ({ supabase }) => {
    const raw = code.trim().split("/").filter(Boolean).pop() ?? "";
    const { data, error } = await supabase.rpc("join_group", { p_code: inviteCodeInput.parse(raw) });
    if (error) socialError(error);
    if (!data) throw new ActionError("Ese código no existe o ya no es válido. Pide uno nuevo.");
    return String(data);
  });
}

export async function rotateGroupCode(id: string) {
  return runAction(async ({ supabase }) => {
    const { error } = await supabase.rpc("rotate_group_code", { p_group: idSchema.parse(id) });
    if (error) socialError(error);
  });
}

export async function leaveGroup(groupId: string) {
  return runAction(async ({ supabase, userId }) => {
    exec(await supabase.from("group_members").delete().eq("group_id", idSchema.parse(groupId)).eq("user_id", userId));
  });
}

export async function removeMember(groupId: string, userId: string) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("group_members").delete().eq("group_id", idSchema.parse(groupId)).eq("user_id", idSchema.parse(userId)));
  });
}

export async function deleteGroup(id: string) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("groups").delete().eq("id", idSchema.parse(id)));
  });
}

export async function createSharedChallenge(input: z.input<typeof sharedChallengeInput>) {
  return runAction(async ({ supabase }) => {
    const { error } = await supabase.from("shared_challenges").insert(sharedChallengeInput.parse(input));
    if (error) socialError(error);
  });
}

export async function deleteSharedChallenge(id: string) {
  return runAction(async ({ supabase }) => {
    exec(await supabase.from("shared_challenges").delete().eq("id", idSchema.parse(id)));
  });
}
