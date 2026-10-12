import { ListChecks } from "lucide-react";
import type { QuickToday } from "@/lib/data/quick";
import { QuickTasks } from "./quick-tasks";

/** Aviso mientras falta pegar la migración; el resto de la app funciona igual. */
export function QuickSetupNotice({ what = "Las tareas rápidas" }: { what?: string }) {
  return (
    <div className="card-tint relative flex items-center gap-4 overflow-hidden rounded-[24px] p-5" data-testid="quick-setup-notice">
      <span className="tone-chip h-11 w-11 rounded-2xl" aria-hidden>
        <ListChecks size={20} />
      </span>
      <p className="text-sm text-muted">
        <span className="font-semibold text-text">{what} se están activando.</span> Falta un paso en la base de datos; el resto de la app funciona con normalidad.
      </p>
    </div>
  );
}

export function QuickTasksCard({ quick, today }: { quick: QuickToday; today: string }) {
  if (!quick.ready) return <QuickSetupNotice />;
  return <QuickTasks tasks={quick.tasks} templates={quick.templates} today={today} />;
}
