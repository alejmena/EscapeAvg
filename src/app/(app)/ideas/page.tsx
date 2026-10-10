import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getSchedule } from "@/lib/data/quick";
import { IdeasView } from "@/components/ideas/ideas-view";

export const metadata: Metadata = { title: "Ideas" };

export default async function IdeasPage({ searchParams }: { searchParams: Promise<{ idea?: string; area?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const blocks = await getSchedule(supabase);
  return <IdeasView blocks={blocks} scheduleReady={blocks !== null} initialIdea={sp.idea ?? null} initialArea={sp.area ?? null} />;
}
