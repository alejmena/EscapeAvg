import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { zonedParts } from "@/lib/domain/dates";
import { getSchedule } from "@/lib/data/quick";
import { PageHeader } from "@/components/ui/card";
import { QuickSetupNotice } from "@/components/microtasks/quick-tasks-card";
import { ScheduleView } from "@/components/schedule/schedule-view";

export const metadata: Metadata = { title: "Horario" };

export default async function SchedulePage() {
  const { supabase, profile } = await requireUser();
  const blocks = await getSchedule(supabase);
  const now = zonedParts(new Date(), profile.timezone);
  return (
    <div>
      <PageHeader title="Horario semanal" subtitle="Tu semana tipo, como un horario de clases. Cada día puede tener sus propias horas." />
      {blocks === null ? <QuickSetupNotice what="El horario" /> : <ScheduleView blocks={blocks} weekday={now.weekday} nowMinute={now.hour * 60 + now.minute} />}
    </div>
  );
}
