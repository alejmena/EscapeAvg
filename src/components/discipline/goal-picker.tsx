"use client";

import { useState } from "react";
import { Check, Crown, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { goalLabel, goalRank, HEAVY_GOAL_MINUTES, rankLabel, RANKS, SYMBOLIC_NOTE } from "@/lib/domain/discipline";
import { updateDailyGoal } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { useAction } from "@/components/tasks/use-action";

const OPTIONS = RANKS.filter((r) => r.minHours >= 3);

/** Objetivo diario: un rango de la tabla o un número de horas personalizado. */
export function GoalPicker({ goalMinutes, ready }: { goalMinutes: number; ready: boolean }) {
  const [value, setValue] = useState(goalMinutes);
  const [custom, setCustom] = useState(goalRank(goalMinutes) ? "" : String(goalMinutes / 60));
  const [saved, setSaved] = useState(false);
  const { run, pending, error } = useAction();
  const save = (minutes: number) => {
    setValue(minutes);
    setSaved(false);
    run(() => updateDailyGoal(minutes), () => setSaved(true));
  };

  return (
    <Card data-testid="goal-picker">
      <CardTitle>Objetivo diario de disciplina</CardTitle>
      <p className="mb-4 text-sm text-muted">
        Elige cuántas horas de desarrollo personal quieres cumplir en un día. Al alcanzarlo, la app te dirá que hiciste lo suficiente: la
        meta no se mueve.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((r) => {
          const minutes = r.minHours * 60;
          const active = value === minutes;
          return (
            <button
              key={r.id}
              type="button"
              disabled={!ready || pending}
              onClick={() => {
                setCustom("");
                save(minutes);
              }}
              className={cn(
                "press flex items-center justify-between gap-3 rounded-2xl border p-3 text-left disabled:opacity-60",
                active ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2",
              )}
              aria-pressed={active}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  {r.minHours >= 10 && <Crown size={13} className="text-[var(--gold)]" />}
                  {rankLabel(r)}
                </span>
                <span className="block text-xs text-muted">
                  {r.minHours} h al día
                  {r.id === "elite1" && " · meta extraordinaria"}
                  {minutes >= HEAVY_GOAL_MINUTES && " · no para cada día"}
                </span>
              </span>
              {active && <Check size={18} className="shrink-0 text-accent" />}
            </button>
          );
        })}
      </div>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const h = Number(custom.replace(",", "."));
          if (h > 0) save(Math.round(h * 60));
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">Personalizado (horas)</span>
          <Input
            type="number"
            min={1}
            max={16}
            step={0.5}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="w-32"
            disabled={!ready}
            aria-label="Objetivo personalizado en horas"
          />
        </label>
        <Button type="submit" variant="secondary" disabled={!ready || !custom || pending}>
          Usar
        </Button>
      </form>
      <p className="mt-3 text-sm">
        Objetivo actual: <span className="font-semibold">{goalLabel(value)}</span>
        {saved && <span className="ml-2 text-success">Guardado</span>}
      </p>
      {value >= HEAVY_GOAL_MINUTES && (
        <p className="mt-2 rounded-xl bg-warning-soft p-3 text-sm text-warning">
          Más de 12 horas al día no es una meta sana para todos los días. Úsala solo para jornadas excepcionales y protege tu sueño y tu
          descanso.
        </p>
      )}
      {!ready && <p className="mt-2 text-sm text-warning">Disponible cuando se active la actualización de la base de datos (aviso en el Inicio).</p>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <p className="mt-3 flex gap-1.5 text-xs text-muted">
        <Info size={13} className="mt-0.5 shrink-0" />
        {SYMBOLIC_NOTE}
      </p>
    </Card>
  );
}
