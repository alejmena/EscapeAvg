import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function NotesIndex() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("boards").select("id").order("position").order("created_at").limit(1);
  if (data?.[0]) redirect(`/notes/${data[0].id}`);
  const { data: created } = await supabase.from("boards").insert({ name: "Mi tablero" }).select("id").single();
  redirect(created ? `/notes/${created.id}` : "/dashboard");
}
