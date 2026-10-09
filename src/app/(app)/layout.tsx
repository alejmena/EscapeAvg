import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getPendingRequests } from "@/lib/data/social";
import type { FocusSession } from "@/lib/types";

// Siempre dinámico: depende de la sesión del usuario.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile, user } = await requireUser();
  const [{ data: active }, pendingRequests] = await Promise.all([
    supabase.from("focus_sessions").select("*").in("status", ["running", "paused"]).maybeSingle<FocusSession>(),
    getPendingRequests(supabase, user.id),
  ]);
  return (
    <AppShell name={profile.display_name ?? user.email ?? ""} activeSession={active ?? null} pendingRequests={pendingRequests}>
      {children}
    </AppShell>
  );
}
