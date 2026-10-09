import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { addDays, eachDay } from "@/lib/domain/dates";
import { groupHistory } from "@/lib/domain/quick";
import { formatLongDate } from "@/lib/format";
import { getQuickHistory, getQuickToday } from "@/lib/data/quick";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/card";
import { QuickSetupNotice } from "@/components/microtasks/quick-tasks-card";
import { QuickSettings } from "@/components/microtasks/quick-settings";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Tareas rápidas" };

export default async function MicrotasksPage() {
  const { supabase, profile, today } = await requireUser();
  const quick = await getQuickToday(supabase, profile, today);
  const header = (
    <PageHeader
      title="Tareas rápidas"
      subtitle="Tu historial de pequeñas tareas, las plantillas de un clic y las que se repiten solas."
      action={
        <Link href="/dashboard" className="flex items-center gap-1 text-sm text-accent hover:underline">
          <ArrowLeft size={15} /> Volver al inicio
        </Link>
      }
    />
  );
  if (!quick.ready) {
    return (
      <div>
        {header}
        <QuickSetupNotice />
      </div>
    );
  }

  const history = await getQuickHistory(supabase, profile, today, 60);
  const byDay = groupHistory(history, profile.timezone);
  const counts = new Map(byDay.map((d) => [d.day, d.titles.length]));
  const last28 = eachDay(addDays(today, -27), today);
  const activeDays = last28.filter((d) => (counts.get(d) ?? 0) > 0).length;
  const max = Math.max(1, ...last28.map((d) => counts.get(d) ?? 0));
  const total28 = last28.reduce((a, d) => a + (counts.get(d) ?? 0), 0);

  return (
    <div className="space-y-6">
      {header}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardTitle>Constancia: últimos 28 días</CardTitle>
            <p className="mb-4 text-sm text-muted">
              <span className="text-2xl font-bold text-text tabular">{activeDays}</span> de 28 días con alguna tarea rápida hecha ·{" "}
              <span className="tabular">{total28}</span> en total
            </p>
            <div className="grid grid-cols-7 gap-1.5" aria-label="Tareas rápidas completadas por día">
              {last28.map((d) => {
                const n = counts.get(d) ?? 0;
                return (
                  <div
                    key={d}
                    title={`${formatLongDate(d)}: ${n} ${n === 1 ? "tarea" : "tareas"}`}
                    className={cn("grid aspect-square place-items-center rounded-lg text-[11px] font-semibold tabular", n ? "text-white" : "bg-surface-2 text-muted/60", d === today && "ring-2 ring-accent")}
                    style={n ? { background: `color-mix(in srgb, var(--ring-tasks) ${35 + Math.round((n / max) * 65)}%, transparent)` } : undefined}
                  >
                    {n || ""}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted">Las tareas rápidas cuentan como tareas completadas, pero no suman tiempo productivo: eso solo lo hace el tiempo que cronometras.</p>
          </Card>

          <Card>
            <CardTitle>Historial</CardTitle>
            {byDay.length === 0 ? (
              <EmptyState title="Aún no hay tareas rápidas completadas">Márcalas en el inicio y aparecerán aquí.</EmptyState>
            ) : (
              <ol className="space-y-4" data-testid="quick-history">
                {byDay.slice(0, 30).map((d) => (
                  <li key={d.day}>
                    <p className="mb-1 flex items-baseline justify-between text-sm font-semibold">
                      <span>{d.day === today ? "Hoy" : formatLongDate(d.day)}</span>
                      <span className="text-xs font-normal text-muted tabular">{d.titles.length}</span>
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {d.titles.map((t, i) => (
                        <li key={i} className="rounded-full bg-success-soft px-2.5 py-1 text-xs text-success">
                          ✓ {t}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
        <QuickSettings templates={quick.templates} carryOver={quick.carryOver} />
      </div>
    </div>
  );
}
