import { ListChecks } from "lucide-react";
import type { QuickToday } from "@/lib/data/quick";
import { QuickTasks } from "./quick-tasks";

/** Aviso mientras falta pegar la migración; el resto de la app funciona igual. */
export function QuickSetupNotice({ what = "Las tareas rápidas" }: { what?: string }) {
  return (
    <div className="card-glass flex items-center gap-3 rounded-[24px] p-5" data-testid="quick-setup-notice">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
        <ListChecks size={20} />
      </span>
      <p className="text-sm text-muted">
        <span className="font-medium text-text">{what} se están activando.</span> Falta un paso en la base de datos; el resto de la app funciona con normalidad.
      </p>
    </div>
  );
}

export function QuickTasksCard({ quick, today }: { quick: QuickToday; today: string }) {
  if (!quick.ready) return <QuickSetupNotice />;
  return <QuickTasks tasks={quick.tasks} templates={quick.templates} today={today} />;
}
